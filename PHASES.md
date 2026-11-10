# Kiezpigeon: phase specs

Nine phases for Tier 1 (`v1.0.0`), then follow-up phases (Phase 9 on). **One phase = one Claude Code session =
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
- Fixtures: saved listing HTML lives in `fixtures/immoscout24/`,
  `fixtures/generic/`, `fixtures/vonovia/` and `fixtures/deutsche-wohnen/`, one file per case, each starting with a comment
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
9. CI in `.github/workflows/ci.yml`: on PRs and pushes to `main`, Node 24,
   `npm ci`, `lint`, `test` (typechecks first), `build`; upload `.output/chrome-mv3/` as a
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
- **Move-in line** (arrived with the ADR 10 work, after Phase 4; not a Phase 1
  deliverable): listing does not say when it is free → `unknown`. Profile has
  no move-in → `unknown`. Free by arrangement → `ok`. Free immediately: a
  fixed move-in date → `warn` (check the landlord can wait), else `ok`. Free
  from a date: move-in as soon as possible or flexible → `ok`; on that date
  or up to 31 days after → `ok`; before it, or more than 31 days after →
  `warn`. Never `no`.
- **Relationship** (a validator check that arrived with the ADR 10 work, after
  Phase 4; not a Phase 1 deliverable): unless the household says married, no
  marriage word (Ehepaar, verheiratet, Ehemann, ...) appears.
- The fit check returns the five lines in that order (`budget`, `income`, `pets`,
  `wbs`, `moveIn`). It never blocks
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
string }`. Facts only, signal order, tone instruction, word limit, no em
   dash instruction, contact person, chosen features, pets sentence when
   present. Tests assert the facts block exactly and that no profile field
   absent from the request appears.
6. `letterValidate`: `validateLetter(text, request): LetterProblem[]` with
   problem codes `too_long`, `em_dash`, `unknown_number`,
   `wrong_salutation`, `pets_missing`, `pets_invented`, `feature_missing`,
   `relationship_invented`, each carrying the offending text. Tests: one passing fixture
   letter under the limit, then one failing case per code.
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

---

## Phase 9: ImmoScout24 in English, and saying why a page is not read

**Context for a fresh session:** v1.0.0 is released (Phases 0 to 8). Two
live checks in Phase 5 found the panel silent on an ImmoScout24 exposé,
because the tab was the site's English address (`/en/expose/<id>`), which
the content script does not match. Since Phase 6 such a page falls through
to the unknown-site fallback, which asks the user to type facts the page
already shows.

**Objective:** an English ImmoScout24 exposé works exactly like a German
one (listing detected, fit check, German letter, "X of Y matched", fill
without submit), and a page Kiezpigeon cannot read says why.

**In scope**

1. Probe first. The automated browser is blocked by ImmoScout24 (Phase 3),
   so the author saves one English exposé with the contact dialog open,
   and the German version of the same listing, from their own Chrome.
   Record in `docs/ai-workflow.md`: whether the `is24qa-*` classes and
   `data-qa` attributes are the same on `/en/`; how the English page
   writes prices, sizes, floor, dates, "immediately" and "by
   arrangement", pets and the feature tags; and whether the contact
   form's field names and select option codes match the German form.
   Probe whether the `activeTab` grant from the icon click lets the panel
   read its tab's URL (`tabs.get(tabId).url`) without the `tabs`
   permission; item 4 depends on it.
2. Fixtures (fixture-driven tier). With `scripts/reduce-fixture.ts`:
   `fixtures/immoscout24/en-listing-complete.html` and
   `en-contact-form.html`, scrubbed as every fixture (header comment, no
   real names, phones, emails, addresses, ids or tracking tokens; read the
   reduced page text, not only the pattern check). The German fixtures
   stay as they are.
3. Adapter and matcher. `matches(url)` and the content script's match
   cover `/en/expose/*` (ADR 8 amendment: a new content script match on
   the same host, no new permission). English values parse to the same
   `Listing` as the German page: a test reads both fixtures of the same
   listing and asserts equal `Listing`s apart from `url`. Features map to
   the existing German feature names, so letters stay German. Any English
   label the field matcher must classify (`First name`, `Move-in date`,
   `Pets`, ...) is added test-first (strict tier; `src/rules/` stays
   pure). Option codes are matched as codes, not labels, where the probe
   shows they are shared.
4. Not-read reasons (smoke test plus manual QA). The not-a-listing screen
   tells three cases apart and words each plainly: an ImmoScout24 page
   that is not an exposé ("This ImmoScout24 page is not a listing. Open a
   listing to start."), a known listing tab opened before the extension
   was loaded ("Reload this tab so Kiezpigeon can read it."), and any
   other site (the existing "Use this page" fallback). The rule that picks
   the case from a URL and the content script's answer is pure and
   test-first. If the item 1 probe shows the URL is not readable without
   a new permission, the screen keeps today's wording and the gap is
   proposed, not built (a permission needs an ADR and the author's yes).
5. Never-submit on English: `e2e/never-submit.spec.ts` gains a run with
   the English contact form fixture served at an `/en/expose/` address.

**Out of scope:** English letters (Tier 2: German stays the default and
the only validated language); other ImmoScout24 locales than `/en/`;
Anrede (needs a profile field and an ADR); a second listing site.

**Acceptance:** on the English fixtures, the e2e runs and the unit tests
are green; on one live English exposé in the author's Chrome (not sent),
the listing card shows the same Kaltmiete, Warmmiete, size, rooms and fit
lines as the German page of the same listing, the letter is German, the
match count equals the German page's, the form stays unsent, and the
consoles show no errors; on a live ImmoScout24 search page, the panel
shows the "not a listing" wording from item 4.

**Phase review checklist:** the German fixtures' tests unchanged and
green; no new permission without an ADR; the English and German
`Listing` of the same exposé are equal in a test; never-submit grep
clean; fixtures scrubbed and read; no personal circumstances of the
author in fixtures, logs or the PR; `package.json` version `1.1.0`, tag
`v1.1.0` pushed by the author after merging.

**PR:** `feat(adapters): immoscout24 in english, clear reasons on unread pages`

## Phase 10: Vonovia, the second listing adapter

**Context for a fresh session:** v1.1.0 is released (Phases 0 to 9).
ImmoScout24 is the only known site; every other site goes through the
fallback, where the user types facts the page already shows. Vonovia lets
its listings be read and its form be opened by an automated browser, and
this is the first site to test the adapter interface from ADR 8. A
read-only probe while writing this spec found (re-check in item 1):

- Listing pages are `https://www.vonovia.de/zuhause-finden/immobilien/`
  plus a slug ending in an object id. Links from the site's emails carry
  tracking parameters, which are never stored.
- The facts are server-rendered as visible label and value rows (`Kaltmiete`,
  `Nebenkosten`, `Warmmiete`, `Größe`, `Zimmer`, `Geschoss`, `Verfügbar ab`,
  `Baujahr`), with an `Ausstattung` list, a location link and a contact card
  of the form `Frau Lastname`. There are no test attributes, so the adapter
  reads rows by their label. The same data sits in a JSON attribute, which
  the adapter does not read (ADR 8) and fixtures must not keep.
- The contact form (`form[name="real-estate-contact-form"]`) is in the page
  before its overlay opens, so being in the DOM does not mean it is open. It
  has no `action`. Its submit button is named `submit`, which shadows
  `form.submit`. It has no consent checkbox.
- It asks for `firstname`, `surename`, `telephone`, `email`, `einkommensart`,
  `monatliches_nettoeinkommen` and `message`, all required except `message`,
  plus a hidden `wrkID` that holds the listing's id.
- Both selects are hidden (`display: none`, `aria-hidden`) behind Slim Select
  widgets, paired by `data-id` on the select and its `.ss-main`. Today they
  count as spam traps and are dropped without a word. Setting the select's
  value and firing `input` and `change` updated the widget and made the
  select valid, with no request sent.

**Objective:** a Vonovia listing works like an ImmoScout24 one: listing
detected, fit check, German letter, "X of Y matched", and a fill that
includes both required dropdowns and never sends.

**In scope**

1. Probe first. Save one listing with the overlay open from the author's
   Chrome, and confirm the findings above on it. Also check whether the
   `/zuhause-finden/immobilien/` address serves anything that is not a
   listing, and how a for-sale object differs. Log the result in
   `docs/ai-workflow.md`.
2. Fixtures (fixture-driven tier). With `scripts/reduce-fixture.ts`:
   `fixtures/vonovia/listing-complete.html`, `listing-missing-fields.html`
   and `contact-form.html`. The reducer gains what the pairing needs
   (`data-id`, `aria-hidden`) and still drops the JSON attribute that holds
   the street, contact and object id. Scrub `wrkID`, the object id in the
   address and page text, the location link and the contact card. Read the
   reduced page text, not only the pattern check.
3. Adapter (`src/adapters/vonovia/`, tests after, against the fixtures).
   `matches(url)` takes listing addresses only. `readListing` reads rows by
   label through the existing German parsers, adding what the probe shows is
   missing (`2. Obergeschoß` as floor 2, the `OT` district in the location).
   Features come from `Ausstattung` under the German names the letter already
   uses. A field the page does not state, such as pets or WBS, goes in
   `missing`. A page with no `Kaltmiete` row, such as a for-sale object,
   returns `undefined`. `contactForm` and `readContactForm` return nothing
   until the overlay is open.
4. Hidden selects (`src/fill/describe.ts`, test first). A hidden `<select>`
   counts as visible only when a visible `.ss-main` with the same `data-id`
   stands in for it. Every other hidden field stays a trap, with a test for
   each case: no widget, a hidden widget, and a widget with another
   `data-id`. This also reaches the fallback, which closes the gap logged in
   Phase 6 for any site using the same widget.
5. Field matching (strict tier, `src/rules/`). A new field kind for
   `Einkommensart` is matched ahead of `income`. It picks the option for own
   income (`eigenes Einkommen`) only when every applicant is `permanent`,
   `fixed_term`, `civil_servant`, `self_employed` or `trainee`. For any other
   employment it fills nothing and the field shows under "Fill these
   yourself", because the profile cannot tell Bürgergeld from
   Arbeitslosengeld, or a student's own income from support. Income bands
   compare whole euros with an inclusive lower bound, so `2.001 - 3.000 EUR`
   takes 2.001 € and `bis 2.000 EUR` takes 2.000,50 €; the existing band tests
   stay green. `keine Angabe` is never chosen.
6. Content script (`src/entrypoints/vonovia.content.ts`, unit test after).
   Matches listing addresses only (ADR 8 amendment, and PLAN.md section 7 in
   the same commit). The handlers ImmoScout24's script holds move into one
   shared helper that takes an adapter, so the two scripts differ only by
   adapter and match, and the ImmoScout24 tests stay unchanged.
7. Not-read reasons and copy (strict tier for `unreadPage`, smoke test plus
   manual QA for the screens). `unreadPage` stops assuming ImmoScout24 and
   returns the site's name, so a Vonovia page that is not a listing, and a
   listing opened before the extension was loaded, read as they do on
   ImmoScout24. An unknown-site or not-read screen that names ImmoScout24 as
   the place to start names both sites.
8. Never-submit: `e2e/never-submit.spec.ts` gains a run with the Vonovia
   form fixture, served at a Vonovia-shaped address, asserting no `submit`
   event, no request and no navigation, with both selects holding the
   profile's values and their widgets showing them.

**Out of scope:** Deutsche Wohnen (the next adapter; its site looks like the
same platform, so note in the PR what it could reuse, but do not build for
it); Vonovia's other languages; for-sale objects; pets, WBS or a new profile
field for income type; reading the page's JSON; a third-party select library
in the extension.

**Acceptance:** the unit tests and e2e runs are green on the fixtures. On one
live Vonovia listing in the author's Chrome (not sent), the listing card
shows the page's Kaltmiete, Warmmiete, size, rooms, floor, availability and
address; the contact person is greeted by name in a German letter; with an
employed profile the panel reports 7 of 7 matched; both dropdowns visibly
show the filled choice; the form stays unsent and the consoles show no
errors. On Vonovia's search results, the panel shows the "not a listing"
wording.

**Phase review checklist:** the ImmoScout24 fixtures' tests unchanged and
green; ADR 8 amended and PLAN.md section 7 updated with the new match; a test
proves a hidden field without a stand-in widget is still not filled; the
hidden `wrkID` is never filled; no raw query string reaches a stored
`Listing`; never-submit grep clean; fixtures scrubbed and read, with no real
street, contact name, object id or tracking token left, and the JSON attribute
gone; no personal circumstances of the author in fixtures, logs or the PR;
`package.json` version `1.2.0`, tag `v1.2.0` pushed by the author after
merging.

**PR:** `feat(adapters): vonovia, the second listing site`

## Phase 11: Deutsche Wohnen, on Vonovia's platform

**Context for a fresh session:** v1.2.0 is released (Phases 0 to 10).
Vonovia has an adapter. Deutsche Wohnen runs the same platform, and today it
goes through the fallback, where the user types facts the page already shows.
A read-only probe of five live listings while writing this spec found
(re-check in item 1):

- The same as Vonovia: the label and value rows, the key figures, the
  `Ausstattung` badges, the contact card, the address link with `OT` for the
  district, and a contact form with the same field names, option codes, hidden
  `wrkID` and Slim Select pairs. Its overlay opens the same way, from a button
  labelled `Anfrage senden`.
- Listing pages are `https://www.deutsche-wohnen.com/mieten/mietangebote/`
  plus a slug ending in an object id. The search page is
  `/mieten/zuhause-mieten`.
- Different from Vonovia, and each breaks today's code if copied as it is:
  the page has **no `<h1>`**, because its title is an `h2.h2.headline`, and
  Vonovia's `isReady` waits for an `h1`, so every read would run into the
  two-second limit and lose the title. The availability figure is labelled
  `Verfügbarkeit` rather than `Bezugsfrei ab`, though the `Verfügbar ab` row is
  there.
- The address, and so presumably the title, is drawn about 150 ms after the
  load event, as on Vonovia. The rows came slightly after the load event on
  some pages, so `isReady` must also hold when the rows are not there yet.
- The double rendering logged in Phase 6 did not show on this probe, with
  cookies declined or accepted: one `main`, one contact form. Item 1 checks it
  again, because that run saw it.

**Objective:** a Deutsche Wohnen listing works like a Vonovia one, with no
second copy of what the two sites share.

**In scope**

1. Probe first, with the automated browser, since the site allows it and no
   page from the author's Chrome is needed. Save one flat with the overlay
   open. Across at least five live listings, record when the title, address and
   rows appear; every `Typ` seen, and any non-flat in the results; and what
   `Verfügbarkeit` and `Verfügbar ab` hold besides a date. Answer the cookie
   banner both ways and look for the double rendering. Log the result in
   `docs/ai-workflow.md`, in general terms.
2. Fixtures (fixture-driven tier), scrubbed as every fixture:
   `fixtures/deutsche-wohnen/listing-complete.html`,
   `listing-missing-fields.html`, `contact-form.html` and
   `search-results.html`. The address appears in more than one place (the link
   text, its `title` attribute, a map id in its `href`) and the postcode can
   stand on a line of its own. Read the reduced text, not only the pattern
   check.
3. Shared reader (tests after; the Vonovia tests stay unchanged and green).
   Move what the sites share out of `src/adapters/vonovia/` into one builder
   that takes the site's id, name and listing address and returns a
   `SiteAdapter`. Vonovia and Deutsche Wohnen each become a thin call to it.
   The title comes from a selector that holds on both sites' fixtures, and
   `isReady` waits for that title, or for the rows if they are later. The
   figure fallback for availability reads both labels. Nothing in the builder
   tests a site by name.
4. Adapter tests (`src/adapters/deutsche-wohnen/`, fixture-driven): the exact
   `Listing` for the complete fixture, what the sparse one lacks, the search
   page as `undefined`, a parking space as `undefined` under the existing `Typ`
   rule, the form empty until the overlay is open, and `matches` refusing
   look-alike hosts and the search page.
5. Content script (`src/entrypoints/deutsche-wohnen.content.ts`). It matches
   `https://www.deutsche-wohnen.com/mieten/mietangebote/*` only (ADR 8
   amendment, and PLAN.md section 7 in the same commit) and calls `answerAs`.
6. Not-read reasons and copy. `unreadPage`'s table gains the site, test first
   (strict tier). The unknown-site screen and the README name all three sites.
7. End to end: `e2e/never-submit.spec.ts` gains a Deutsche Wohnen run on its
   form fixture, and a reload with the panel open on a page that draws its
   title late, without an `h1`. `e2e/fallback.spec.ts` gains its not-a-listing
   page.

**Out of scope:** filtering the long `Ausstattung` list into fewer highlights
(Tier 2 if it gets in the way); other languages; for-sale objects; any change
to letters, the profile or the fit check; any other site.

**Acceptance:** unit and e2e runs are green on the fixtures. In the built
extension on at least three live listings, scripted with an invented profile, a
stubbed letter and non-GET requests to the site blocked: with the panel opened
straight after load **and** after a reload with it open, the listing card shows
the title, Kaltmiete, Warmmiete, size, rooms and district; on one of them the
overlay opened by hand reports 7 of 7 matched with an employed profile, both
dropdowns visibly show the filled choice, and no request is made. Then the
author's own Chrome (not sent), with a real letter: the contact person is
greeted by name, the form stays unsent and the service worker, panel and page
consoles show no errors. On the site's search page after an icon click, the
panel shows the "not a listing" wording. The PLAN.md box is ticked only after
the author's check.

**Phase review checklist:** Vonovia's and ImmoScout24's tests unchanged and
green, and Vonovia checked again on one live listing after the move; ADR 8
amended and PLAN.md section 7 updated; no new entry in `permissions` or
`host_permissions`; never-submit grep clean; the hidden `wrkID` never filled;
no raw query string in a stored `Listing`; fixtures scrubbed and read, with no
real street, contact name, object id or tracking token, the `title` attribute
and map id included; no personal circumstances of the author in fixtures, logs
or the PR; `package.json` version `1.3.0`, tag `v1.3.0` pushed after merging.

**PR:** `feat(adapters): deutsche wohnen, sharing vonovia's platform reader`

---

## Phase 12: Filled pigeons

**Context for a fresh session:** v1.3.0 is released (Phases 0 to 11). The
tracker saves an application only when the user presses "Yes, I sent it"
after a fill (Phase 7). In use that question is easy to walk past: the
letter is written, the form filled, Send pressed on the page, the tab
closed, and the tracker never hears of it.

**Objective:** every letter that went into a form is a pigeon from that
moment, marked Filled until the user says it was sent. The extension still
never detects or claims sending; Filled says only what it did itself.

**In scope**

1. Rules (strict tier, ADR 13 amendment in the same commit).
   `ApplicationStatus` gains `filled`. `sentAt` becomes optional and the
   validator requires it for every status but `filled`. `newApplication`
   can save a filled record, which has no `sentAt`. `setStatus` sets
   `sentAt` when a record first leaves `filled` and drops it on the way
   back, so a sent date is never invented. `refill` replaces the letter of
   a filled record after a later fill that wrote; a sent record keeps the
   letter that was sent. Stats gain `filled` and `sentTotal`;
   `sentLast7Days` counts only records with a send date. Order is by
   `sentAt`, else by `statusChangedAt`. The export version stays 2: the
   file's shape is unchanged, and a build before this phase refuses the new
   status the way it refuses any unknown value, all or nothing.
2. Letter screen. After a fill whose report says it wrote, the application
   is saved as filled with the letter as it went into the form; a later
   fill that wrote replaces the letter while the record is still filled.
   The card below the form then says it is in your pigeons, marked Filled,
   and asks "Did you send it?"; "Yes, I sent it" marks it sent. If saving
   failed, the card says why and the button still saves a sent record, as
   it did before.
3. Tracker. The Filled pill uses the design system's pending role
   (`sun-deep` with `sun-soft`); a Filled filter chip; "Mark as filled" as
   the correction for a record marked sent by mistake; the meta line reads
   "filled 01.02.2027" until there is a send date; the Sent tile counts
   only records that were sent; a tip for filled letters never marked sent.
4. End to end: `e2e/tracker.spec.ts` gains a filled record among the
   counts and filters; `e2e/never-submit.spec.ts` sees the filled pigeon
   before the click and the sent one after it.
5. README and the tip copy say what happens now.

**Out of scope:** detecting a send (never), reminders (Tier 2), letter
history (Tier 2).

**Acceptance:** fill a form on a fixture page; the tracker shows the row as
Filled with no further click; "Yes, I sent it" turns it Sent with today's
date; an export written before this phase still imports.

**Phase review checklist:** no copy claims a letter was sent; status is
never colour alone; stats come from the rules function; `sentAt` is never
set by anything but the user's word.

**PR:** `feat(tracker): keep every filled letter as a pigeon`

---

## Phase 13: About this listing

**Context for a fresh session:** v1.4.0 is released (Phases 0 to 12). The
Listing detected screen shows the rent, size and rooms and the fit check,
and nothing about what kind of rental the page describes, how its price
sits, or whether anything on it deserves a second look. The design is in
`docs/superpowers/specs/2026-11-06-listing-analysis-design.md` and the
plan in `docs/superpowers/plans/2026-11-06-listing-analysis.md`.

**Objective:** an "About this listing" card, from the page alone, that
informs and never judges: the kind of rental, the Kaltmiete per m² against
the band the page itself prints,
and what is worth a second look.

**In scope**

1. Rules (strict tier). `Listing` gains `flatType`, `kautionCents`,
   `offeredBy`, `priceComparison` and `hints`, all optional and named in
   `missing`. `rentalHints` scans page text into flags; phrases that rule
   a thing out are removed first. `analyseListing` builds the lines with
   exact copy: the kind from positive signals only, `unknown` when the
   description could not be read; the price against the band, "well
   above" and "well below" as notes; the notes in a fixed order (Kaution over three Kaltmieten
   unless a Genossenschaft, Nebenkosten over half the Kaltmiete, a
   Provision asked, no viewing, payment first, a landlord abroad, much
   cheaper). ADR 14 and the ADR 8 amendment in the same commit.
2. ImmoScout24 (fixture tier): the type and Kaution rows, the "von privat"
   or "Gewerblich" marker, the "Ø Angebotspreis" band with its sample size
   and radius, all four numbers or nothing, and the hints from the title,
   the description, the Sonstiges and condition rows and the feature tags.
3. Vonovia and Deutsche Wohnen: the Art and Kaution rows and the title,
   Beschreibung and Sonstige Angaben cards. No offerer, no band.
4. The card, between the stat tiles and the fit check, hidden on the
   typed-facts flow. Plain lines carry their label word, notes the
   exclamation, nothing found the tick. Checked in Chromium on the
   complete and the sparse ImmoScout24 fixture.
5. README, PLAN.md, this spec, the friction log, release 1.5.0.

**Out of scope:** a greeting line (built, then removed on the author's
first use: it repeats what the letter screen shows), bundled market data, storing the analysis, detecting a send.

**Acceptance:** on the complete ImmoScout24 fixture the card reads the kind
and price lines and "Nothing on the page stood out."; on the sparse
fixture it reads "Möbliert, offered privately." from its title and "This
page shows no comparison"; a Kaution above three Kaltmieten adds the
deposit note.

**Phase review checklist:** no copy claims or judges, and the words scam,
fraud, Betrug and warning appear nowhere; status is never colour alone;
the letter flow is untouched; rules stay pure; `missing` names every
field a page lacks.

**PR:** `feat(listing): the about-this-listing card`
