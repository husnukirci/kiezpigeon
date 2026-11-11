# Analyse this listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A secondary "Analyse this listing" button on the Listing detected screen that, on click, sends the listing's text and a fit subset of the profile to Opus 5.5 and shows a six-section analysis in Kiezpigeon's own voice.

**Architecture:** The content script returns the listing region's visible text (`getPageText`). The panel builds an `AnalysisRequest` with a pure rule that strips the user's own values from that text and keeps only fit facts from the profile, then sends it to the service worker (`analyseListing`). The worker builds the prompt with a pure rule, calls the existing Claude client with `claude-opus-5-5`, parses the answer into sections with a pure rule and returns them with provider-neutral error messages. The panel keeps results per listing URL for the panel's lifetime; nothing is stored.

**Tech Stack:** TypeScript strict, WXT, React 19, CSS Modules on generated tokens, Vitest + happy-dom + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-analyse-this-listing-design.md`

**Branch and PR:** `phase/14-analyse-listing` from `origin/main` after the spec and this plan are merged. One PR. Never merge.

## Global Constraints

- The request is sent only on the user's click, from the service worker, through `src/claude/`, to `https://api.anthropic.com`. No new permission, no new host, nothing in `wxt.config.ts` changes; the built manifest is byte-identical before and after.
- Model `claude-opus-5-5` for this call, whatever `settings.model` says. Effort `low`, as the letter call.
- Sent from the profile: `budgetWarmCents`, `household` (adults, children, pets, smoker), `hasWbs`, `moveIn`, each applicant's `employment`, and the income-to-rent ratio in tenths. Never sent: names, `contact` (email, phone, street, house number, postcode, city), `job`, raw `netIncomeCents`, `letterDefaults`, `documents`.
- Every value of the profile's applicant first and last names, email, phone and street is removed from the page text before the request leaves the panel.
- The listing's own facts (address, district, contact person) are sent.
- New copy never contains `Claude`, `Anthropic`, `AI`, `model` or `assistant` (case-insensitive, whole word). Existing copy is not changed, including `ERROR_MESSAGES` in `src/claude/claude.ts`, Settings and Onboarding.
- Section headings, in order: `What this is`, `The area`, `Price`, `Heating and energy`, `For you`, `What to watch for`.
- Copy: English, sentence case, "you", buttons are verbs, no em dashes, German market terms stay German, never claims something was sent for the user.
- Nothing is written to `chrome.storage`; no new stored field.
- "Write my letter" stays the one teal (`primary`) button; the new button is `secondary`.
- Known sites only (ImmoScout24, Vonovia, Deutsche Wohnen): not shown when `onEditFacts` is set (typed facts on an unknown site).
- Import boundaries: `src/rules/` imports only itself; `src/adapters/` imports `src/rules/` and `src/fill/` only.
- Conventional commits, one logical change each; no AI attribution trailer.

## Review Focus

1. The user's email or name in the page in another case or split by extra whitespace (`MARA  TESTMANN`, `Mara.Testmann@Example.org`) is still removed. Test in Task 1.
2. An answer that has none of the six headings is shown whole under one section, not dropped; an answer with an unknown heading keeps the known ones and folds the unknown text into the section before it. Tests in Task 3.
3. The user opens another listing while an analysis is running: the result is kept for the listing it was asked for and never shown on the other one. Test in Task 6.
4. A page longer than the text cap is cut at the cap, not refused. Test in Task 1.
5. A key that cannot use Opus 5.5 (403 naming the model) gets the neutral `model_unavailable` analysis message, which names neither the provider nor a model. Test in Task 5.

---

### Task 1: The analysis request (strict tier)

**Files:**

- Modify: `src/rules/types.ts` (add `AnalysisRequest`)
- Create: `src/rules/analysisRequest.ts`, `src/rules/analysisRequest.test.ts`

**Interfaces:**

- Produces:

  ```ts
  // types.ts
  export interface AnalysisRequest {
    listing: Listing;
    /** The listing region's text with the user's own values removed. */
    pageText: string;
    budgetWarmCents?: Cents;
    household: Household;
    hasWbs: boolean;
    moveIn?: MoveIn;
    employment: EmploymentType[];
    /** Combined net income / Kaltmiete in tenths, floored; absent without rent. */
    incomeRatioTenths?: number;
  }
  // analysisRequest.ts
  export const PAGE_TEXT_MAX = 20_000;
  export function createAnalysisRequest(
    profile: Profile,
    listing: Listing,
    pageText: string,
  ): AnalysisRequest;
  ```

- [ ] **Step 1: Write the failing tests** in `analysisRequest.test.ts`, using `coupleWithDog` from `test-support/sample-profiles` and `kreuzbergListing` (the listing `letterPrompt.test.ts` uses; import it from where that test does):
  - `"keeps only the fit facts from the profile"`: `Object.keys(request).sort()` equals `["budgetWarmCents","employment","hasWbs","household","incomeRatioTenths","listing","moveIn","pageText"]` (drop keys the sample leaves undefined); `JSON.stringify(request)` contains neither applicant's `firstName`, `lastName`, `job`, nor `contact.email`, `contact.phone`, `contact.street`, nor any `netIncomeCents` value as a number.
  - `"removes the user's names, email, phone and street from the page text"`: one test per field, page text `"Angemeldet als <value> | Schöne Wohnung"` → `pageText` does not contain the value and still contains `"Schöne Wohnung"`.
  - `"removes them in any case and spacing"` (Review Focus 1): `"MARA  TESTMANN"` and the email upper-cased are removed (use the sample's real values, transformed).
  - `"keeps the listing's own contact and address"`: a page text with the listing's `contactPerson.lastName` and `address` keeps both.
  - `"cuts a long page at the cap"` (Review Focus 4): `"a ".repeat(15_000)` gives `pageText.length <= PAGE_TEXT_MAX`, no throw.
  - `"has the income ratio as the letter has it"`: equals `incomeRatioTenths(createLetterRequest(profile, listing, {tone:"warm", features: []}))`; absent when the listing has no `kaltmieteCents`.
- [ ] **Step 2: Run** `npx vitest run src/rules/analysisRequest.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** Removal: for each non-empty value, build a case-insensitive regex from the value's whitespace-separated parts escaped and joined by `\s+`, replace with `…`. Collapse runs of whitespace, then cut to `PAGE_TEXT_MAX`. Reuse `incomeRatioTenths`'s arithmetic by extracting a helper from `letterPrompt.ts` if needed (one copy).
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): the analysis request keeps fit facts and drops the user's own values`.

### Task 2: The analysis prompt (strict tier)

**Files:**

- Modify: `src/rules/letterPrompt.ts` (`LetterPrompt` becomes `export type LetterPrompt = Prompt`), `src/rules/types.ts` (add `Prompt`), `src/claude/claude.ts` (`generate(prompt: Prompt, …)`)
- Create: `src/rules/analysisPrompt.ts`, `src/rules/analysisPrompt.test.ts`

**Interfaces:**

- Consumes: `AnalysisRequest` (Task 1).
- Produces:

  ```ts
  export interface Prompt {
    system: string;
    user: string;
  } // types.ts
  export const ANALYSIS_HEADINGS = [
    "What this is",
    "The area",
    "Price",
    "Heating and energy",
    "For you",
    "What to watch for",
  ] as const;
  export type AnalysisHeading = (typeof ANALYSIS_HEADINGS)[number];
  export function buildAnalysisPrompt(request: AnalysisRequest): Prompt;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `"asks for the six headings in order"`: each heading appears in `system` as `## <heading>` and in `ANALYSIS_HEADINGS` order.
  - `"puts the page text and the facts in the user part"`: `user` contains `request.pageText`, the budget formatted as euros, the pet kinds and counts, `WBS` yes/no, the move-in, and the ratio as `3.2` style.
  - `"says what is missing from the profile"`: a request without `budgetWarmCents` has `user` containing `budget: not given`.
  - `"sets the rules"`: `system` contains the instructions for English, estimates worded as estimates, unknown said as unknown, no em dashes, no verdict words (`scam`, `fraud`) and not to claim to have checked anything outside the page; and contains none of `Claude`, `Anthropic`.
  - `"is pure"`: two calls with the same request give equal prompts.
- [ ] **Step 2: Run** `npx vitest run src/rules/analysisPrompt.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `buildAnalysisPrompt` in `analysisPrompt.ts`; the `Prompt` rename keeps `buildLetterPrompt`'s output identical.
- [ ] **Step 4: Run** the same command, then `npm test`. Expected: PASS, every letter prompt test unchanged.
- [ ] **Step 5: Commit** `feat(rules): the analysis prompt asks for six sections from the page and the fit facts`.

### Task 3: Parsing the answer (strict tier)

**Files:**

- Create: `src/rules/analysisParse.ts`, `src/rules/analysisParse.test.ts`

**Interfaces:**

- Consumes: `ANALYSIS_HEADINGS`, `AnalysisHeading` (Task 2).
- Produces:

  ```ts
  export interface AnalysisSection {
    heading: AnalysisHeading | "Analysis";
    text: string;
  }
  export const ANALYSIS_TEXT_MAX = 6_000;
  export function parseAnalysis(text: string): AnalysisSection[];
  ```

- [ ] **Step 1: Write the failing tests:**
  - `"splits by the known headings in order"`: a text with all six `## ` headings gives six sections with trimmed text.
  - `"drops empty sections"`.
  - `"replaces em dashes"`: `"Gut — aber"` → `"Gut, aber"`; no `—` in any output.
  - `"shows a text without headings whole"` (Review Focus 2): returns `[{ heading: "Analysis", text }]`.
  - `"folds an unknown heading into the section before it"` (Review Focus 2).
  - `"caps the length"`: total text of all sections `<= ANALYSIS_TEXT_MAX`, cut at a word boundary.
  - `"accepts headings with bold or a colon"`: `**Price:**` and `### Price` both start the Price section.
- [ ] **Step 2: Run** `npx vitest run src/rules/analysisParse.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `parseAnalysis`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rules): parse the analysis into its sections`.

### Task 4: The listing region's text (adapters, tests after)

**Files:**

- Modify: `src/adapters/types.ts` (add `listingRoot`), `src/adapters/immoscout24/immoscout24.ts`, `src/adapters/estatePlatform.ts`, `src/adapters/dom.ts` (add `visibleText`), `src/messaging/messaging.ts` (add `getPageText`), `src/messaging/siteScript.ts`
- Test: the three adapter test files, `src/adapters/dom.test.ts` (create if absent), `src/messaging/siteScript.test.ts` (or where `answerAs` is tested)

**Interfaces:**

- Produces:

  ```ts
  // SiteAdapter
  /** The element holding the listing itself, without the site's header or account menu. */
  listingRoot(document: Document): Element | undefined;
  // dom.ts
  export function visibleText(root: Element): string; // textContent without script/style/noscript/template, whitespace collapsed
  // messaging.ts
  export type PageTextResult = { kind: "text"; text: string } | { kind: "no_text" };
  getPageText: { request: { type: "getPageText" }; response: PageTextResult };
  ```

- [ ] **Step 1: Implement** `listingRoot`: ImmoScout24 `#is24-content`; estate platform (Vonovia, Deutsche Wohnen) the `main` that contains `.real-estate-hero`. Check both against every `listing-*.html` fixture. Implement `visibleText`. Add `getPageText` to `Messages` and `HANDLED`; `answerAs` answers it with `untilReady`, then `listingRoot` → `visibleText`, `no_text` when the root is missing or the text is empty.
- [ ] **Step 2: Write the tests:** each adapter's `listingRoot` on its `listing-complete.html` fixture returns an element whose `visibleText` contains the fixture's title and Kaltmiete as printed, and not the site header's text (pick a header string from the fixture); on `search-results.html` it returns `undefined` or text without a listing title (pin what it does). `visibleText` drops a `<script>`'s content. `answerAs` answers `getPageText` with `no_text` on a document with no root.
- [ ] **Step 3: Run** `npx vitest run src/adapters src/messaging && npm run lint`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(adapters): read the listing region's text when the panel asks`.

### Task 5: The analysis in the service worker, ADR and invariant

**Files:**

- Create: `src/claude/analysisService.ts`, `src/claude/analysisService.test.ts`
- Modify: `src/messaging/messaging.ts` (add `analyseListing`), `src/entrypoints/background.ts`, `docs/decisions.md` (ADR 14 amendment), `CLAUDE.md` (one invariant line), `docs/ai-workflow.md` if anything was reworded

**Interfaces:**

- Consumes: `AnalysisRequest` (Task 1), `buildAnalysisPrompt` (Task 2), `parseAnalysis`, `AnalysisSection` (Task 3), `createClaudeClient`, `toClaudeError`, `ClaudeErrorCode` (existing).
- Produces:

  ```ts
  export const ANALYSIS_MODEL: ClaudeModel = "claude-opus-5-5";
  export const ANALYSIS_ERROR_MESSAGES: Record<ClaudeErrorCode, string>;
  export type AnalysisResult =
    | { kind: "analysis"; sections: AnalysisSection[] }
    | { kind: "error"; code: ClaudeErrorCode; message: string };
  export function analyseListing(
    request: AnalysisRequest,
    createClient?: (apiKey: string) => ClaudeClient,
  ): Promise<AnalysisResult>;
  // messaging.ts
  analyseListing: {
    request: {
      type: "analyseListing";
      request: AnalysisRequest;
    }
    response: AnalysisResult;
  }
  ```

- [ ] **Step 1: Write the tests** (unit, after; storage via WXT's fake browser as `letterService.test.ts` does):
  - happy path: a stub client returning a two-heading text → `kind: "analysis"` with two sections; the stub saw `model === "claude-opus-5-5"` even when `settings.model` is `claude-haiku-5-5`.
  - no key → `{ kind: "error", code: "no_key", message: ANALYSIS_ERROR_MESSAGES.no_key }`.
  - `model_unavailable` from the client (Review Focus 5) → the analysis message.
  - `"no message names the provider"`: every value of `ANALYSIS_ERROR_MESSAGES` fails `/\b(claude|anthropic|ai|model|assistant)\b/i` and contains no `—`.
- [ ] **Step 2: Implement.** Messages, exact copy:
  - `no_key`: "Connect your key in settings to analyse listings."
  - `invalid_key`: "Your key was not accepted. Check it in settings, or create a new one."
  - `rate_limited`: "Your key hit its rate limit. Wait a minute, then try again."
  - `unavailable`: "The analysis is busy right now. Try again in a minute."
  - `network`: "Kiezpigeon could not reach the analysis. Check your connection."
  - `timeout`: "The analysis took too long. Try again."
  - `refused`: "This listing could not be analysed. Try again later."
  - `no_credit`: "Your account has no credit left. Add credit, then try again."
  - `model_unavailable`: "Your key cannot run the analysis. Check its access in your account."
  - `cut_off`: "The analysis was cut off. Try again."
  - `failed`: "The listing could not be analysed. Try again."

  Register `analyseListing` in `background.ts` beside `generateLetter`.

- [ ] **Step 3: Write the ADR 14 amendment** (Nygard: Status / Context / Decision / Consequences) from the spec's "Documents this changes", naming its running probes (`analysisRequest.test.ts`, `analysisPrompt.test.ts`, `analysisService.test.ts`). Replace the CLAUDE.md line "The only network request the extension makes is the letter generation call (destination fixed by ADR 4), on an explicit user action." with "The extension makes two kinds of network request, both to the destination fixed by ADR 4 and both on an explicit user action: generating a letter and analysing a listing."
- [ ] **Step 4: Run** `npm test && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** (ADR and code together, per ground rule 4) `feat(claude): analyse a listing on request with Opus 5.5`.

### Task 6: The button and the result on the Listing detected screen

**Files:**

- Create: `src/ui/hooks/useAnalysis.ts`, `src/ui/screens/ListingDetected/ListingAnalysis.tsx`, `ListingAnalysis.module.css`, `ListingAnalysis.test.tsx`
- Modify: `src/ui/screens/Home/ListingFlow.tsx`, `src/ui/screens/ListingDetected/ListingDetected.tsx`

**Interfaces:**

- Consumes: `send`, `getPageText`, `analyseListing` (Tasks 4, 5), `createAnalysisRequest` (Task 1), `AnalysisSection` (Task 3).
- Produces:

  ```ts
  export type AnalysisState =
    | { status: "idle" }
    | { status: "reading" }
    | { status: "ready"; sections: AnalysisSection[] }
    | { status: "failed"; message: string };
  /** Results keyed by listing URL for the panel's lifetime. */
  export function useAnalysis(
    ownTab: number | undefined,
    profile: Profile,
  ): {
    stateFor(url: string): AnalysisState;
    analyse(listing: Listing): void;
  };
  // ListingDetected gains: analysis?: { state: AnalysisState; onAnalyse: () => void }
  ```

- [ ] **Step 1: Implement.** `useAnalysis` lives in `ListingFlow` (above `ListingDetected`, so Back from the letter shows the result again). `analyse` sets `reading` for that URL, sends `getPageText` to `ownTab`, on `no_text` fails with "Kiezpigeon could not read this page's text.", else sends `analyseListing` with `createAnalysisRequest(profile, listing, text)` and writes the result under the URL it started with (Review Focus 3). A rejected `send` fails with "Kiezpigeon could not start the analysis. Close the panel, open it again and retry." `ListingDetected` renders `<ListingAnalysis>` right after `<AnalysisCard>`, and only when `onEditFacts` is unset.

  `ListingAnalysis` copy: card title "A closer look"; idle shows the lead "A deeper read of this listing: the area, the price, heating and how it fits you. About 5 cents on your key." and a `secondary` `<Button>` "Analyse this listing"; reading shows "Reading the listing" with `role="status"` and the button disabled; ready shows each section as an `<h3>` plus its paragraphs, then the caption "An estimate from the page and what is known about the area. Check anything that matters before you rely on it."; failed shows the message with `role="alert"` and the button again as "Try again". Styles only `var(--…)` tokens.

- [ ] **Step 2: Write the tests** (smoke tier, `ListingAnalysis.test.tsx`, plus one `ListingFlow`-level test):
  - idle shows the button; clicking calls `onAnalyse`.
  - ready shows the six headings in order as level-3 headings and the caption.
  - failed shows the message as an alert and "Try again".
  - no rendered text in any state matches `/\b(claude|anthropic|ai|model|assistant)\b/i`.
  - `ListingDetected` with `onEditFacts` set renders no "Analyse this listing".
  - Review Focus 3: with `send` stubbed, start an analysis on listing A, switch the flow to listing B before the answer resolves, resolve it: B shows the idle button, switching back to A shows the result.
- [ ] **Step 3: Run** `npm run lint && npm test`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(ui): analyse this listing on the listing screen`.

### Task 7: End to end, phase docs, close out

**Files:**

- Create: `e2e/analysis.spec.ts`
- Modify: `PHASES.md` (Phase 14 from the spec), `PLAN.md` (the phase's line and checkbox), `README.md` if it lists features

- [ ] **Step 1: Write** `e2e/analysis.spec.ts` with `launchExtension` and `openPanel` from `e2e/support.ts`: serve the ImmoScout24 `contact-form.html` fixture at an exposé URL with a page header that contains `coupleWithDog`'s first applicant's email, store `coupleWithDog` and a placeholder key, route `https://api.anthropic.com/**` to a canned answer with all six headings, click "Analyse this listing". Assert: the six headings show; exactly one request reached the API route; its JSON body has `model: "claude-opus-5-5"`, and the body contains neither applicant's first name, last name or the email; no request is made before the click.
- [ ] **Step 2: Run** `npm run test:e2e`. Expected: the previous 17 pass, 1 skipped, plus the new one passes.
- [ ] **Step 3: Write** Phase 14 in `PHASES.md` (In scope, Out of scope, checklists) from the spec, and tick its line in `PLAN.md`.
- [ ] **Step 4: Verify:** `npm run lint && npm test && npm run build && npm run test:e2e`, and the built manifest is identical to the one built on `main` (`diff`). Load the build unpacked in Chrome: on a saved fixture page and on one live listing per known site, click the button once each (a real key; about 5 cents a click), read the result, and check the service worker, panel and content script consoles are clean. Note in the PR body what the live runs showed, in general terms only (no listing ids, no addresses, no personal data).
- [ ] **Step 5: Commit** `docs(phases): phase 14, analyse this listing` and `test(e2e): the analysis sends no names and only on the click`; push `phase/14-analyse-listing` and open the PR. Do not merge.
