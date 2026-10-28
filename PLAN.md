# Kiezpigeon: build plan

A Chrome extension (Manifest V3) for the Berlin apartment hunt. Open a
listing, open the side panel: Kiezpigeon reads the listing, checks it
against your profile, writes a short, specific German application letter,
and fills the listing's contact form. You review everything and press Send
yourself. It never submits.

Scope is tiered so the project is releasable at every milestone: Tier 1 is a
complete, usable v1; Tiers 2 and 3 are follow-ups, not prerequisites.

Design system: https://claude.ai/artifact/5M9uVbsEWmLzmcsTc54yoo
(`project/README.md`, `project/tokens.json`, component READMEs). Tech
choices: `docs/decisions.md`, ADRs 1 to 7, **proposed, not yet accepted**.

---

## 1. Goal

1. A tested rules core: fit check with reasons, the letter prompt builder,
   the letter validator (length, no em dashes, no invented facts, pets
   honesty, chosen features present), form field matching with an
   "X of Y matched" score, tracker stats and filters, profile validation and
   export/import. Built strictly test-first, free of browser APIs.
2. A working extension: onboarding and profile in the side panel, an
   ImmoScout24 adapter that reads a listing and its contact form, letter
   generation through Claude with tone switch, rewrite, edit and copy, form
   filling that never submits, a confirmed fallback for unknown sites, and a
   tracker of applications.
3. A UI that is the design system: every screen styled with its tokens only,
   accessible, and usable at 320px to 400px panel width.
4. The engineering process as a first-class deliverable: tiered plan, ADRs,
   CLAUDE.md working agreement, AI workflow log, CI.

Non-goals: auto-submitting anything; storing or uploading documents
(SCHUFA, payslips, ID); crawling or watching listing sites in the
background; accounts or cloud sync; any server that stores user data;
publishing to the Chrome Web Store in Tier 1.

## 2. Domain in one paragraph

A **profile** holds one or two **applicants** (name, job, employment type,
net monthly income in cents), a **household** (adults, children, pets with
kind, smoker yes/no), a desired **move-in date**, **contact details** for
the form (email, phone, current address), a **budget** (max Warmmiete), a
**WBS** flag, **letter defaults** (tone `warm | formal | short`, language
`de | en`) and a **documents checklist** of `ready | pending` flags
(SCHUFA, Mietschuldenfreiheitsbescheinigung, income proofs, ID, WBS).
A **listing** is what an **adapter** reads from one site's page: title,
address and district, Kaltmiete, Nebenkosten, Warmmiete, size, rooms, floor,
available-from date, pet policy, WBS requirement, contact person, a list of
**features** (Balkon, Altbau, Einbauküche, ...), and the page's **contact
form**. The **fit check** compares profile and listing and returns one line
per rule (budget, income vs 3 × Kaltmiete, pets, WBS), each `ok | warn | no
| unknown` with a reason; it informs, it never blocks. A **letter request**
is the profile facts, the listing facts, the chosen tone and 1 or 2 chosen
features; the **letter validator** accepts or rejects the generated text
with named problems. **Form mapping** pairs each fillable form field with a
profile value or the letter and reports how many matched. An
**application** is a saved record of a letter for a listing with a status
`sent | viewing | closed`. All rules are pure functions over plain data.

**Profile fields added beyond the brief, to confirm:** budget (the fit check
needs it), WBS flag (the WBS rule needs it), contact details (every contact
form asks for email and phone).

## 3. Tiers

### Tier 1: v1 release

- [ ] Tech choices accepted: ADRs 1 to 7 moved from proposed to accepted;
      CLAUDE.md "Tech invariants" filled in
- [ ] Scaffold: extension skeleton with service worker, side panel and one
      content script; tokens pipeline from the design system's
      `tokens.json`; bundled Plus Jakarta Sans; lint, format, typecheck,
      unit tests, build; CI on every push and PR
- [ ] Rules core (strict TDD, no browser APIs):
  - [ ] types: `Profile`, `Applicant`, `Household`, `Listing`, `FitLine`,
        `LetterRequest`, `LetterProblem`, `FormField`, `FieldMapping`,
        `Application`
  - [ ] `profile`: validation, defaults, export/import with schema version
  - [ ] `money` and `format`: cents arithmetic, German number, money and
        date formatting helpers for the UI
  - [ ] `fit`: budget, income vs 3 × Kaltmiete, pets, WBS, with exact reasons
  - [ ] `letterPrompt`: build the prompt from a `LetterRequest`, facts only
  - [ ] `letterValidate`: word count, em dashes, numbers not in the facts,
        pets mentioned when present (and not when absent), chosen features
        present, salutation matches the contact person
  - [ ] `fieldMatch`: classify form fields, map to profile values, score
  - [ ] `tracker`: status transitions, stats, filters
- [ ] Profile and onboarding: step flow (applicants, household, move-in and
      budget, documents checklist, letter defaults), settings with export,
      import and delete all data
- [ ] Listing detection: adapter interface; ImmoScout24 adapter tested
      against scrubbed saved HTML; "Listing detected" screen with stat
      tiles and the fit check card
- [ ] Letter generation: Claude client per ADR 4; validate and retry once;
      "Letter ready" screen with tone switch, highlight chips, rewrite,
      edit, copy
- [ ] Form filling: ImmoScout24 contact form mapping, "X of Y matched",
      fill on click, never submit, send reminder; generic fallback for
      unknown sites with a confirm step before filling
- [ ] Tracker: save an application when the user confirms they sent it;
      statuses Sent, Viewing, Closed; stat tiles; filters
- [ ] Docs: README (what it does, install unpacked, privacy section,
      screenshots), `docs/decisions.md`, `CLAUDE.md`, `docs/ai-workflow.md`;
      personal data scrub; `v1.0.0` tag

### Tier 2: follow-ups

- [ ] A second listing adapter (candidates: Immowelt, Kleinanzeigen,
      WG-Gesucht), proving the adapter interface with a second real site
- [ ] English letters as a first-class option with their own validator
      rules (German stays the default)
- [ ] Letter history per listing and "start from my last letter"
- [ ] Tracker reminders (follow up after N days with no reply) via
      `chrome.alarms`, still local only
- [ ] Simplified 16px toolbar icon (the design system notes it is still to
      be drawn)

### Tier 3: stretch

Chrome Web Store listing with a privacy policy; a small backend if ADR 4
starts with the user's own key; Firefox port; encrypted export. Listed so
cuts are deliberate and discussable, not accidental. Tiers 2 and 3 may never
ship; Tier 1 is complete without them.

## 4. Build order

Detailed, self-contained phase specs live in **PHASES.md**. Workflow: one
phase = one Claude Code session = one PR. Each session reads only CLAUDE.md,
PLAN.md, and its phase spec; implements; self-reviews against the phase and
global checklists; fixes findings; opens the PR and stops. The author
merges, then starts the next phase in a fresh session.

| Phase | Work                                                                                       | PR              |
| ----- | ------------------------------------------------------------------------------------------ | --------------- |
| P0    | Scaffold per accepted ADRs: MV3 skeleton, side panel, tokens pipeline, font, tooling, CI    | chore(scaffold) |
| P1    | Rules core, strict TDD (types → money/format → profile → fit → letterPrompt → letterValidate → fieldMatch → tracker) | feat(rules) |
| P2    | Storage layer, onboarding and profile screens, settings with export/import/delete           | feat(profile)   |
| P3    | Adapter interface, ImmoScout24 listing adapter on fixtures, messaging, "Listing detected" + fit card | feat(listing) |
| P4    | Claude client, generate → validate → retry, "Letter ready" screen, tone, rewrite, edit, copy | feat(letter)    |
| P5    | ImmoScout24 contact form adapter, fill without submit, "X of Y matched", send reminder       | feat(fill)      |
| P6    | Generic form fallback for unknown sites with confirm-before-fill                            | feat(fallback)  |
| P7    | Tracker: save on "I sent it", statuses, stats, filters, pigeon tip                          | feat(tracker)   |
| P8    | Docs, ADR audit, ai-workflow finalize, README + screenshots, data scrub, v1 tag              | docs            |

Each phase lands green (tests, typecheck, lint, build, manual check in
Chrome where the phase is user-visible) before the next starts.

## 5. TDD tiers

- **Strict (red-green-refactor, no exceptions):** the rules core: `profile`,
  `money`, `format`, `fit`, `letterPrompt`, `letterValidate`, `fieldMatch`,
  `tracker`.
- **Fixture-driven (test after, against saved HTML):** site adapters. Each
  adapter has at least three scrubbed fixtures (complete listing, listing
  with missing fields, a page that is not a listing) and asserts the exact
  `Listing` it returns. Form adapters additionally prove that filling sets
  values, fires `input`/`change`, and never submits.
- **Pragmatic (test after, happy path + one edge, browser APIs stubbed):**
  the storage layer and its schema migration, panel ↔ content script
  messaging, the Claude client (request shape, error mapping, no key in
  logs).
- **Smoke (one per screen) + manual QA in Chrome:** side panel screens.
  End-to-end: one scripted run that loads the built extension on a local
  fixture page, fills the form, and asserts it was not submitted (tooling
  per ADR 5).
- **Untested by design:** the decorative sky, and the wording of generated
  letters beyond what the validator checks. Written down here so it's a
  decision, not a gap.

## 6. ADRs to write (short-form Nygard)

Proposed now, accepted before P0 (see `docs/decisions.md`):

1. Extension framework and build setup
2. UI framework for the side panel
3. State and storage
4. How the extension talks to the Claude API
5. Testing approach and tooling
6. Repo structure
7. Styling with design tokens only

Expected during the build:

8. Adapter interface: one adapter per site, DOM in, `Listing` and form out
   (P3)
9. Letter validation as the guarantee; generate, validate, retry once (P4)
10. Never submit: how filling works on framework-driven forms (P5)
11. Fallback field classification for unknown sites (P6)

## 7. Manifest permissions (Tier 1, to confirm in P0)

- `sidePanel`: the UI.
- `storage`: profile, settings, applications (plus `unlimitedStorage` only
  if ADR 3 needs it).
- `activeTab` and `scripting`: read and fill the tab the user is on, on
  user action, including unknown sites for the fallback.
- Host permission for `https://www.immobilienscout24.de/*`: the known
  adapter's content script.
- The Claude API host (or the backend host), per ADR 4.

No `tabs`, `history`, `webRequest`, `cookies` or `<all_urls>`.

## 8. Risks

- **Site markup changes.** ImmoScout24 can change its DOM at any time.
  Adapters read stable attributes first, fail soft (partial `Listing` with a
  `missing` list) and the fixtures make a breakage visible in one test run.
- **Site terms and bot detection.** Kiezpigeon reads one page the user has
  open and fills fields the user would type; it never fetches or submits.
  Still, the README states the extension is unaffiliated and the user is
  responsible for using it within each site's terms.
- **Generated facts.** A model can invent a detail. The validator rejects
  numbers not in the facts and a wrong salutation; invented prose details it
  cannot catch, which is why the user reviews every letter.
- **API cost and key safety.** Depends on ADR 4.

## 9. Definition of done (Tier 1)

Fresh clone → install → build → "Load unpacked" works per the README; CI
green; a user can complete onboarding, open an ImmoScout24 listing, see the
fit check with reasons, generate a German letter of 120 to 180 words that
passes the validator, switch tone and rewrite, edit and copy it, fill the
contact form and see "X of Y fields matched", find the form unsubmitted
with the send reminder visible, use the fallback on an unknown site only
after confirming the mapping, mark the application sent and see it in the
tracker with stats and filters, export, import and delete all data; every
rule has a test that fails when it is broken; the "never submit" test fails
if a submit is introduced; the grep for real names, phone numbers, emails
and keys in fixtures and docs comes back empty; docs read in under ten
minutes.
