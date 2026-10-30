# Kiezpigeon: phase specs

Nine phases for Tier 1 (`v1.0.0`). **One phase = one Claude Code session =
one PR.** Each spec is self-contained: a fresh session reading only
`CLAUDE.md`, `PLAN.md`, and its own phase section has everything it needs.
No phase depends on chat history.

Drafted before the tech choices; the stack-specific lines were filled in
when ADRs 1 to 7 were accepted. Paths follow the folder map in ADR 6.

## How a phase runs

1. **Start a fresh Claude Code session** in the repo. First instruction: read
   `CLAUDE.md`, `PLAN.md`, and the current phase in `PHASES.md`. Nothing
   else. The design system (README, `tokens.json`, the relevant component
   README) is the tie-breaker for any visual question; read only the part you
   need.
2. **Probe the risky assumption first.** If the phase relies on a library
   behaviour, a browser API or a site's markup that has not been seen
   working in this repo, prove it with a throwaway check before building on
   it, and log the result in `docs/ai-workflow.md`.
3. **Implement** the "In scope" list in order. Respect the TDD tier stated
   per item. Small conventional commits on a branch named
   `phase/<n>-<slug>`.
4. **Self-review** against the phase's review checklist _and_ the global
   checklist below. Fix findings in follow-up commits (do not amend history).
5. **Open the PR** with the title given in the phase spec. PR description:
   what shipped, what was deliberately not done, review findings that were
   fixed, how it was verified in Chrome, and anything punted (with a PLAN.md
   tier reference).
6. **Stop.** The author merges. The next phase starts in a new session.

### Global self-review checklist (every phase)

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all
      green; `npm run test:e2e` green from Phase 5 on
- [ ] User-visible or content-script change: built extension loaded
      unpacked in Chrome, verified, no console errors in service worker,
      side panel or content script
- [ ] Every "In scope" item done or explicitly listed as punted in the PR
- [ ] No scope creep: nothing from a later phase or higher tier snuck in
- [ ] New load-bearing decisions have an ADR in `docs/decisions.md`; any new
      permission, network destination or stored field has one
- [ ] `docs/ai-workflow.md` has at least the friction log entries from this
      session
- [ ] No real personal data in the diff: fixtures scrubbed, sample profiles
      invented, no API key (grep for `@`, phone-number shapes, `sk-ant-`)
- [ ] No personal circumstances of the author anywhere, PR description
      and PR comments included: no real names, relationship, job
      situation, income, or quotes from real letters and listings
- [ ] No AI attribution: no AI co-author trailer in any commit, no tool
      footer in the PR description; read the PR body before
      `gh pr create` (commitlint and the Attribution workflow enforce it)
- [ ] Never-submit grep: no `.submit(`, `requestSubmit`,
      `new SubmitEvent`, `dispatchEvent(new Event("submit"`, `.click()` on
      a button outside the panel's own UI, or synthetic `Enter` key events
- [ ] The rules core still imports nothing from browser APIs, the UI
      framework, the DOM or the network (check every import line)
- [ ] Styles use tokens only: no raw hex, px font sizes, spacings or radii
      outside the generated tokens file
- [ ] No em dashes in UI copy, fixtures of expected letters, or docs
- [ ] Dead code, commented-out blocks and stray `console.log` removed
- [ ] Re-read the diff top to bottom as a reviewer would; note and fix
      anything you would flag on a teammate's PR

### Shared conventions (every phase)

- Ids are strings: applications `app_<random>`, applicants `a1`, `a2`.
- Money is integer cents; sizes in m² are numbers with up to one decimal;
  dates are ISO `YYYY-MM-DD` strings in data, German `DD.MM.YYYY` in the UI.
- Fixtures: saved listing HTML lives in `fixtures/immoscout24/` and
  `fixtures/generic/`, one file per case, each starting with a comment
  `<!-- scrubbed: names, phones, emails, addresses, ids replaced -->`.
- Sample profiles: invented people from `test-support/sample-profiles.ts`,
  used by every test and screenshot.
- UI copy in English; generated letters in German by default.
- npm scripts (added as phases need them): `dev` (`wxt`), `build`
  (`wxt build`), `zip` (`wxt zip`), `tokens` (regenerate
  `src/styles/tokens.css`), `lint` (ESLint + stylelint), `format`,
  `typecheck` (`tsc --noEmit`), `test` (typecheck, then `vitest run`),
  `test:e2e` (build, then Playwright).
- Tests sit next to their code as `*.test.ts(x)`; Playwright tests in
  `e2e/*.spec.ts`.

---

## Phase 0: Scaffold, tokens, tooling, CI

**Context for a fresh session:** repository contains only planning docs and
accepted ADRs 1 to 7. This phase creates the extension skeleton and proves
the pipeline end to end. No product code.

**Objective:** an extension that loads unpacked in Chrome, opens a side
panel styled with the design system tokens, and a CI pipeline that builds
and tests it.

**In scope**

1. Project skeleton per ADRs 1, 2 and 6: WXT with the React module and
   `srcDir: "src"`, React 19, TypeScript strict (`strict`,
   `noUncheckedIndexedAccess`) in a `tsconfig.json` extending WXT's
   generated one, npm with the lockfile committed, `.nvmrc` = `24` and
   `"engines": { "node": ">=24" }`. Probe first: WXT's current major and its
   React module install and build an empty side panel; log the versions.
   Empty folders from the ADR 6 map are not created until a phase needs
   them.
2. Manifest V3 with exactly the permissions in PLAN.md section 7 that this
   phase needs (`sidePanel`, `storage`), name, description, icons from the
   design system's Brand group (16, 32, 48, 128). The toolbar action opens
   the side panel.
3. `src/entrypoints/background.ts` as a no-op service worker that opens
   the side panel on action click; `src/entrypoints/sidepanel/` (`index.html`,
   `main.tsx`); `src/entrypoints/immoscout24.content.ts` matching
   `https://www.immobilienscout24.de/expose/*` that does nothing yet but
   answer a `ping` message.
4. Tokens pipeline (ADR 7): `design/tokens.json` copied verbatim from the
   design system's `project/tokens.json`; `scripts/build-tokens.ts`
   (`npm run tokens`) generates `src/styles/tokens.css` with one custom
   property per colour, spacing, radius and size token (`--night-800`,
   `--space-4`, `--radius-xl`, `--tap-min`) and one class per type style
   (`.type-title-xl`, `.type-body`, ...), headed `/* generated from
design/tokens.json, do not edit */`. `scripts/build-tokens.test.ts`
   regenerates in memory and fails if the committed file differs.
5. Plus Jakarta Sans 400, 600, 700, 800 as woff2 in `public/fonts/` with its
   OFL licence, declared in `src/styles/fonts.css`; no remote font loading.
   Icons from the design system's Brand group in `public/icon/` (16, 32, 48,
   128).
6. Side panel placeholder: PanelHeader (icon, wordmark, settings icon
   button, sky decoration) and one line of body text, styled with tokens
   only, at 320px and 400px width.
7. Lint and test gates: ESLint flat config (typescript-eslint, React hooks)
   with the ADR 6 `no-restricted-imports` boundaries already in place;
   stylelint with `stylelint-declaration-strict-value` per ADR 7 (the
   generated `tokens.css` ignored); Prettier; `tsc --noEmit`; Vitest with
   WXT's Vitest plugin and happy-dom, and the tokens staleness test as the
   first real test; `wxt build`.
8. Git hygiene: husky + lint-staged (Prettier, ESLint, stylelint on staged
   files), commitlint with `@commitlint/config-conventional`.
9. CI in `.github/workflows/ci.yml`: on push and PR, Node 24, `npm ci`,
   `lint`, `typecheck`, `test`, `build`; upload `.output/chrome-mv3/` as a
   workflow artifact. The Playwright job is added in Phase 5.
10. `README.md` stub: one-liner, "build and load unpacked" steps, links to
    PLAN.md and PHASES.md, the "never submits" and "data stays on your
    device" promises.
11. `docs/ai-workflow.md` gains this session's entries; ADRs 1 to 7 already
    accepted (they were accepted before this phase).

**Out of scope:** any rule, any storage, any screen beyond the header
placeholder.

**Acceptance:** fresh clone, the README steps, "Load unpacked": the toolbar
icon opens the side panel showing the header on `night-800` in Plus Jakarta
Sans; DevTools on the panel shows no network request for fonts; CI green.

**Phase review checklist:** CI failed at least once during setup and you saw
why; no framework template leftovers (sample components, logos, demo
styles); lockfile committed; manifest has no permission beyond this phase's
need; the tokens staleness test fails when `tokens.json` changes and passes
after regeneration; the header's contrast pairs match the design system's.

**PR:** `chore(scaffold): mv3 skeleton, side panel, tokens pipeline, CI`

---

## Phase 1: Rules core (strict TDD)

**Context for a fresh session:** scaffold exists (Phase 0). This phase
builds every product rule as plain TypeScript. **No imports from browser
APIs (`chrome.*`), the DOM, the UI framework, storage or network anywhere in
`src/rules/`.** Strict red-green-refactor: every
behaviour gets a failing test first. The current date is passed in, never
read.

**Objective:** a fully tested fit check, letter prompt builder, letter
validator, field matcher and tracker that later phases call with plain
data.

**Domain rules (authoritative):**

- **Income** is the sum of `netIncomeCents` of all applicants (1 or 2).
- **Budget line:** rent = `warmmieteCents`, else `kaltmieteCents +
nebenkostenCents` when both known, else unknown. No budget in the profile →
  `unknown`, reason `Set a budget in your profile`. rent ≤ budget → `ok`,
  `Within your 1.300 € budget`. rent ≤ budget × 1.10 → `warn`, `90 € over
your budget`. Otherwise `no`, `260 € over your budget`.
- **Income line:** Kaltmiete unknown → `unknown`. ratio = income /
  Kaltmiete, floored to one decimal. ratio ≥ 3.0 → `ok`, `Income is 3.4 ×
Kaltmiete`. Otherwise `warn`, `Income is 2.6 × Kaltmiete. Many landlords
ask for 3 ×.` Never `no`: landlords decide, not Kiezpigeon.
- **Pets line:** household has no pets → `ok`, `No pets`. Listing
  `allowed` → `ok`, `Pets allowed`. Listing `by_arrangement` or unknown →
  `warn`, `Pets by arrangement. I'll mention them honestly.` Listing
  `not_allowed` → `no`, `No pets allowed here`.
- **WBS line:** listing requires WBS: profile has WBS → `ok`, `You have a
WBS`; else `no`, `This flat needs a WBS`. Listing says not required → `ok`,
  `No WBS needed`. Listing silent → `unknown`, `No WBS mentioned in the listing`.
- The fit check returns the four lines in that order. It never blocks
  writing a letter.
- **Letter word count:** a word is a maximal run of non-whitespace that
  contains at least one letter or digit. The whole letter counts,
  salutation and sign-off included. At most 180; no minimum since the
  ADR 9 amendment of 2026-10-29 (it was 120).
- **Dashes:** U+2014 (em dash) anywhere is a problem. U+2013 (en dash)
  with whitespace on both sides is a problem (it is being used as an em
  dash). An en dash between two digits (`18–20`) is allowed.
- **Numbers:** every number in the letter (digit runs, German formatted:
  `1.180`, `3.450,00`, `62`, `01.03.2027` split into its parts) must be in
  the allowed set built from the letter request: incomes, rents, size,
  rooms, floor, household counts, move-in and available-from dates and their
  parts, listing year values, and the contact form values. Number words
  (`zwei`) are not checked.
- **Salutation:** contact person known → the first line contains their
  surname (`Sehr geehrte Frau Weber,` / `Sehr geehrter Herr Weber,` /
  `Guten Tag Frau Weber,`). Unknown → the first line is `Sehr geehrte Damen
und Herren,`.
- **Pets honesty:** household has pets → for every pet kind the letter
  contains its keyword (`Hund`, `Katze`, plus a small table for others) or
  a general `Haustier`. No pets → no pet keyword appears.
- **Features:** 1 or 2 chosen features; each chosen feature's keyword
  appears in the letter. A request with 0 or more than 2 is invalid input.
- **Signal order** (prompt builder only): facts are listed strongest first:
  unbefristete Festanstellung or Beamte, income ratio when ≥ 3, all
  documents ready, non-smoking household without pets, move-in date at or
  before available-from. The builder states the order; the validator does
  not grade prose.
- **Form fields:** field kinds are `salutation`, `firstName`, `lastName`,
  `email`, `phone`, `street`, `houseNumber`, `postcode`, `city`, `message`,
  `adults`, `children`, `pets`, `smoker`, `income`, `employment`,
  `moveInDate`, `wbs`, `consent`, `unknown`. A field counts toward **Y** when
  it is visible, enabled, and not `hidden`, `submit`, `button`, `file`,
  `password` or a captcha. It counts toward **X** when its kind is known,
  not `consent`, and the profile or letter has a value for it. **Consent and
  privacy checkboxes are never ticked.**
- **Tracker:** statuses `sent | viewing | closed`; any status may be set
  from any other (the user corrects mistakes), each change records
  `statusChangedAt`. Stats: total, sent, viewing, closed, sent in the last 7
  days (relative to the passed-in date). Filters: all, sent, viewing,
  closed; newest first.
- **Export:** `{ "kiezpigeon": 1, "exportedAt": ..., "profile": ...,
"applications": [...] }`. Import rejects a file with an unknown schema
  version or invalid fields and names every problem; it never half-imports.
  The Claude API key, if any, is never part of an export.

**In scope** (in order, each strict TDD)

1. `types`: the domain types named in PLAN.md section 3, with `Listing`
   fields optional where a page may not show them, and `missing: string[]`.
2. `money` and `format`: cents helpers; `formatEuro(118000) === "1.180 €"`,
   `formatArea(62) === "62 m²"`, `formatDate("2027-03-01") ===
"01.03.2027"`, using the German grouping rules without relying on the
   runtime's `Intl` locale data being present (test both ways).
3. `profile`: validation (1 or 2 applicants, non-negative cents, counts ≥ 0,
   adults ≥ 1, dates valid), defaults (tone `warm`, language `de`), export
   and import per the rules above.
4. `fit`: `checkFit(profile, listing): FitLine[]` with the exact reasons.
   Tests: every branch of every line, including the 10% edge and the 3.0
   edge.
5. `letterPrompt`: `buildLetterPrompt(request): { system: string; user:
string }`. Facts only, signal order, tone instruction, word range, no em
   dash instruction, contact person, chosen features, pets sentence when
   present. Tests assert the facts block exactly and that no profile field
   absent from the request appears.
6. `letterValidate`: `validateLetter(text, request): LetterProblem[]` with
   problem codes `too_short`, `too_long`, `em_dash`, `unknown_number`,
   `wrong_salutation`, `pets_missing`, `pets_invented`, `feature_missing`,
   each carrying the offending text. Tests: one passing 150-word fixture
   letter, then one failing case per code.
7. `fieldMatch`: `classifyField(descriptor): FieldKind` from `name`, `id`,
   `autocomplete`, label text and placeholder against a German and English
   keyword table; `mapFields(descriptors, profile, letter): { mappings,
matched, total }`. Descriptors are plain data, not DOM nodes.
8. `tracker`: `setStatus`, `stats`, `filter` per the rules above.

**Out of scope:** storage, DOM reading, any network call, any screen.

**Acceptance:** the suite runs in well under a second; a mutation check
(flip one comparison in `fit`, remove one problem code in `letterValidate`)
breaks at least one test each, recorded in the PR.

**Phase review checklist:** every test was seen failing first; the rules
folder has zero imports outside itself and the language's standard library;
no `Date.now()` or `Math.random()` in rules; reason strings match the spec
character for character; no em dash in any expected string.

**PR:** `feat(rules): fit check, letter prompt and validator, field matching, tracker`

---

## Phase 2: Storage, onboarding, profile, settings

**Context for a fresh session:** rules core exists (Phase 1). This phase
gives the profile a home and the user a way to fill it in.

**Objective:** a first-run user completes onboarding in the side panel; the
profile survives a browser restart; settings export, import and delete.

**In scope**

1. `src/storage/` per ADR 3: typed `read`/`write` of `profile`,
   `settings`, `applications` in `chrome.storage.local` with a
   `schemaVersion` and a migration hook (no migrations yet), validation on
   read through the Phase 1 validators, a `clearAll()`, and a
   `useStored(key)` React hook in `src/ui/hooks/` driven by
   `chrome.storage.onChanged`. Pragmatic tests against WXT's fake browser.
2. Onboarding flow (design system screen 1) in steps with the progress
   segments: (1) applicants: name, job, employment type, net income; dashed
   "Add co-applicant" for the second; (2) household: adults and children
   steppers, pets toggle with kind, smoker toggle, move-in date, budget, WBS
   flag, email, phone, current address; (3) documents checklist as
   ready/pending chips; (4) letter defaults: tone and language segmented
   controls. "Continue" is the one teal button per step.
3. Profile screen reachable from the header settings button, same fields,
   saves on change with validation errors shown per TextField rules.
4. Settings: export (downloads the JSON per Phase 1), import (file picker,
   shows every problem or replaces the data after a confirm), delete all
   data (confirm, then clears storage and returns to onboarding).
5. Components used by these screens built from the design system: Button,
   Card, TextField, Stepper, SegmentedControl, Chip, PanelHeader, as React
   components in `src/ui/components/<Name>/` with a `<Name>.module.css`
   each; screens in `src/ui/screens/`.
6. Smoke test per screen with `@testing-library/react`; manual QA at 320px
   and 400px, keyboard only.

**Out of scope:** listing reading, the Claude key field (Phase 4), tracker.

**Acceptance:** a fresh install opens onboarding; after finishing it,
closing Chrome and reopening shows the profile; export, delete all, import
the export: the profile is back identical.

**Phase review checklist:** no document file input anywhere; the documents
checklist stores flags only; every input has a `<label>`; focus ring
visible on every control; errors use `sun`, never red; delete all really
leaves storage empty (checked in DevTools).

**PR:** `feat(profile): storage, onboarding, profile and settings screens`

---

## Phase 3: Listing adapter and fit check screen

**Context for a fresh session:** profile exists (Phase 2). This phase reads
an ImmoScout24 listing.

**Objective:** opening the panel on an ImmoScout24 listing shows "Listing
detected", the listing's key numbers and the fit check.

**In scope**

1. Probe first: save three real ImmoScout24 listing pages, scrub them
   (CLAUDE.md rule 6), and record in `docs/ai-workflow.md` which fields are
   in stable attributes or structured data and which only in visible text.
2. Adapter interface (ADR 8): `matches(url)`, `readListing(document):
Listing`, `readContactForm(document): FormFieldDescriptor[]` (form part
   used in Phase 5). Adapters never throw on a missing field; they fill
   `missing`.
3. ImmoScout24 listing adapter: title, address and district, Kaltmiete,
   Nebenkosten, Warmmiete, size, rooms, floor, available-from, pet policy,
   WBS requirement, contact person, features. Fixture tests: complete
   listing, listing with missing fields, a search results page (not a
   listing).
4. `src/messaging/`: a typed message union (`ping`, `getListing`, and the
   later `getContactForm`, `fill`, `generateLetter`) with one send and one
   handle helper over `chrome.runtime` and `chrome.tabs.sendMessage`. The
   panel asks the active tab's content script for the listing when it opens
   and when the tab URL changes. Adapters live in `src/adapters/`
   (`types.ts`, `immoscout24/`); the content script only calls them.
5. "Listing detected" screen (design system screen 2): detected badge with
   site name, title, meta line (`Prenzlauer Berg · 62 m² · 2. OG`), three
   stat tiles (Kaltmiete, Warmmiete, rooms), fit check card with one line
   per rule (tick or exclamation icon plus reason), tone segmented control,
   highlight chips from the listing's features (choose 1 or 2), "Write my
   letter" (disabled until Phase 4 wires it; shows "Coming next" only in
   this phase's build).
6. Not-a-listing state: a calm empty screen that says what Kiezpigeon needs.

**Out of scope:** letter generation, form reading, other sites.

**Acceptance:** on each saved fixture served locally and on one live
listing, the panel shows the right numbers and fit lines.

**Phase review checklist:** fixtures scrubbed and marked; adapter reads
nothing outside the listing page; no request is made to ImmoScout24 by the
extension; chips cap at 2 selected with the third press explained;
missing fields show as "not shown in listing", not as 0.

**PR:** `feat(listing): immoscout24 adapter, messaging, listing detected screen`

---

## Phase 4: Letter generation

**Context for a fresh session:** listing and fit check exist (Phase 3).
This phase writes the letter.

**Objective:** "Write my letter" produces a German letter that passes the
validator, and the user can switch tone, rewrite, edit and copy.

**In scope**

1. Probe first (ADR 4): a request from the service worker to the Messages
   API with a real key succeeds; log what headers it needed. Then
   `src/claude/`: `generate({ system, user }, { model }): Promise<string>`
   calling `https://api.anthropic.com` from the service worker only (the
   panel sends `generateLetter`), default model `claude-sonnet-5-5`,
   `claude-haiku-5-5` selectable in settings, a timeout, error mapping to
   user-facing messages (no key, invalid key, rate limited, network). The
   key is entered in settings (and offered as a "connect Claude" step after
   onboarding), stored under `apiKey`, never exported, never logged. Host
   permission `https://api.anthropic.com/*` added to `wxt.config.ts`.
2. Generate → validate → retry once with the problems listed in the retry
   prompt → if still invalid, show the letter with the problems as
   warnings. ADR 9.
3. "Letter ready" screen (design system screen 3): letter on `paper`,
   Rewrite / Edit / Copy row, tone switch re-generates, edit in place with
   the validator re-run live (word count shown), copy to clipboard with a
   confirmation.
4. The facts passed to the model are exactly the `LetterRequest`; a
   pragmatic test asserts the request body contains no field outside it.

**Out of scope:** form filling, saving to the tracker.

**Acceptance:** on three fixture listings with two sample profiles
(one with a dog), every generated letter is at most 180 words, uses the
contact person's surname, mentions the dog, contains no em dash, and every
number in it is in the facts; recorded in the PR with the letters.

**Phase review checklist:** no key in logs, storage dumps in tests, or
error messages; the request is sent only on a click; a failed call leaves
the UI usable; copy does not alter the letter.

**PR:** `feat(letter): claude client, validated generation, letter ready screen`

---

## Phase 5: Form filling on ImmoScout24

**Context for a fresh session:** letters exist (Phase 4). This phase fills
the contact form.

**Objective:** "Fill the form" fills ImmoScout24's contact form, shows
"X of Y fields matched" and leaves the form unsubmitted.

**In scope**

1. Probe first: on a scrubbed fixture of the contact form, find how the
   page's framework reads values; record which events make it accept a
   programmatic value (ADR 11).
2. `readContactForm` in the ImmoScout24 adapter returns descriptors; the
   Phase 1 matcher maps them.
3. Fill: set each matched field and fire the events from the probe; never
   tick consent; never touch file inputs; never focus or click submit.
4. Form fields card with the match pill (`8 of 9 matched`), the unmatched
   fields named, "Fill the form" as the teal button, and the reminder "You
   review and press Send yourself." under it.
5. Never-submit test: on a local fixture page whose form records any submit
   attempt, a fill leaves the record empty (Vitest, happy-dom). Plus
   `e2e/never-submit.spec.ts` (Playwright): Chromium with
   `.output/chrome-mv3/` loaded, a fixture served from `fixtures/`, the panel
   page opened by its `chrome-extension://` URL, "Fill the form" pressed,
   the fixture's submit record asserted empty. `npm run test:e2e` and a
   Playwright job in CI on every PR. The fill code lives in `src/fill/`.

**Out of scope:** unknown sites, the tracker.

**Acceptance:** on the fixture and one live listing (not sent), every
matched field holds the expected value, the page's own validation accepts
them, and nothing was submitted.

**Phase review checklist:** never-submit grep clean; consent boxes
untouched; the count shown equals the matcher's numbers; a field the page
already had filled by the user is not overwritten without saying so.

**PR:** `feat(fill): immoscout24 contact form, match count, never submit`

---

## Phase 6: Fallback for unknown sites

**Context for a fresh session:** ImmoScout24 filling exists (Phase 5).
This phase handles any other page with a contact form.

**Objective:** on an unknown site, the user sees what Kiezpigeon would
fill, confirms, and only then is anything filled.

**In scope**

1. On user action only, inject a script into the active tab via
   `activeTab` + `scripting`; read visible forms into descriptors (ADR 12).
2. Listing facts on an unknown site: the user types or confirms rent,
   contact person and features in the panel; nothing is guessed silently.
3. Preview: a list of "field label → value" pairs with per-field opt-out;
   "Fill the form" fills only after this confirm.
4. Same fill engine and never-submit guarantees as Phase 5; the
   never-submit test runs against a generic fixture form too.

**Out of scope:** saving per-site mappings (Tier 2 candidate).

**Acceptance:** on two generic fixture forms, the preview lists the right
pairs, opting out of one leaves that field empty, nothing is submitted.

**Phase review checklist:** no host permission was added for the fallback;
nothing is read from the page before the user acts; preview and fill use
the same mapping object.

**PR:** `feat(fallback): confirm-before-fill for unknown sites`

---

## Phase 7: Tracker

**Context for a fresh session:** filling exists (Phases 5 and 6). This
phase remembers applications.

**Objective:** "Your pigeons": every application the user sent, with
status, stats and filters.

**In scope**

1. After a fill, the panel asks "Did you send it?"; "Yes, I sent it" saves
   an `Application` (listing summary, letter, date, status `sent`). The
   extension does not detect or claim sending.
2. Tracker screen (design system screen 4): stat tiles, filter chips (All,
   Sent, Viewing, Closed), rows with StatusPill, change status per row,
   open the listing URL, the pigeon tip card.
3. Applications are part of export, import and delete all.

**Out of scope:** reminders (Tier 2), notes per application.

**Acceptance:** three saved applications across statuses show correct
counts and filter correctly; closing Chrome keeps them.

**Phase review checklist:** status is never colour alone; closed rows drop
to `ink-muted`; stats come from the Phase 1 function, not recomputed in the
UI.

**PR:** `feat(tracker): applications, status, stats and filters`

---

## Phase 8: Docs, ADR audit, v1 release

**Context for a fresh session:** Tier 1 features are done.

**Objective:** a repo a stranger can install, understand and trust in ten
minutes.

**In scope**

1. README: what it does, the four screens as screenshots (invented
   profile), install unpacked, privacy section (what is stored, where, the
   one network call, delete all), "never submits" with how it is tested,
   unaffiliated-with-listing-sites note.
2. ADR audit: every ADR matches the code as shipped; statuses updated.
3. `docs/ai-workflow.md`: per-phase narrative and closing reflection,
   written from the log and the PR descriptions only.
4. Personal data scrub: grep fixtures, docs and history for names, phones,
   emails and keys; fix anything found.
5. Tag `v1.0.0` (the author pushes the tag after merging).

**Out of scope:** Chrome Web Store submission (Tier 3).

**Acceptance:** PLAN.md section 9 holds, checked item by item in the PR.

**PR:** `docs: readme, adr audit, ai workflow, v1.0.0`
