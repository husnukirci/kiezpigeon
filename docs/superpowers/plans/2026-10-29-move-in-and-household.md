# Move-in choice, listing availability and household relationship: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show when a listing's flat is free and compare it with when the applicants can move, let the profile say "as soon as possible" or "flexible" instead of only a date, and let two applicants say how they are related, so letters can use both honestly.

**Architecture:** Two discriminated unions replace two optional dates: `Listing.availability` (date, immediately, by arrangement) and `Profile.moveIn` (date, as soon as possible, flexible). `Household.relationship` is a new optional field. Stored data moves to schema 2 through the existing migration machinery in `src/storage/`, and export files move to version 2 while version 1 files still import. Rules change test-first; the adapter is fixture-tested; the UI gets one control each.

**Tech Stack:** As in CLAUDE.md "Tech invariants": WXT, TypeScript strict, React 19, Vitest + happy-dom + Testing Library, CSS Modules on design tokens.

**Spec:** The conversation of 2026-10-29 that led to this plan. In short, the author asked for three things:

1. Show when the apartment is free.
2. Let the move-in time be "doesn't matter" or "immediately".
3. Let a couple say so in the letter.

The agreed design is the three numbered parts under Goal; this plan is the written spec.

## Global Constraints

- CLAUDE.md applies in full: no real personal data; rules are pure; money in integer cents; UI copy in sentence case with no em dashes; tokens only in CSS; every control a real labelled element with a 44px minimum target.
- A new stored data field is load-bearing: ADR 10 in `docs/decisions.md` lands in the same commit as the first stored change (Task 1) and is amended in the commit that adds the relationship (Task 6).
- Rules files (`src/rules/`) are strict red-green-refactor: each new rule's test is run and seen failing before the code exists.
- The adapter reads only visible attributes (ADR 8). A new fixture starts with `<!-- scrubbed: names, phones, emails, addresses, ids replaced -->` and states in its header that it is derived from `listing-complete.html`.
- Letters must never claim a fact the profile does not hold: no move-in claim without a stated move-in, no relationship claim without a stated relationship, and no gendered wording about the applicants ("meine Freundin", "mein Partner").
- Branch `feat/move-in-and-household`, one PR, small conventional commits, no co-author trailer and no AI attribution in commits or the PR body.

## Review Focus

1. **A user with a stored profile from before this change** opens the panel and their move-in date is still there. Task 1 covers this with the storage migration test.
2. **An old export file (version 1) is imported after the change**, and the import succeeds with the date carried over. Task 1 covers this with an import test.
3. **The co-applicant is removed after a relationship was set.** The stored profile must not keep a relationship that no longer applies, and no letter may mention it. Task 6 covers this with a `createLetterRequest` test and Task 7 with a draft test.
4. **A listing page writes "ab sofort", "Sofort", or "nach Absprache"** instead of the exact phrases. Each still reads as immediately or by arrangement. Task 2 covers this with `parseAvailability` table rows.
5. **A letter mentions marriage in a compound word or an inflected form** ("Ehepaar", "verheiratete", "Eheleute") without Married being picked. The validator flags it. "Mehr" and "ehemalig" must not be flagged. Task 6 covers this with validator rows.

---

## File map

| File                                                                                | Change                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules/types.ts`                                                                | `MoveIn`, `Availability`, `Relationship`; `Profile.moveIn`, `LetterRequest.moveIn`, `Listing.availability`, `Household.relationship`; problem code `relationship_invented`; fit rule `moveIn` |
| `src/rules/profile.ts`                                                              | read `moveIn` and `relationship`; `upgradeProfileV1`; `EXPORT_VERSION = 2`, import accepts 1 and 2                                                                                            |
| `src/rules/format.ts`                                                               | `formatAvailability`                                                                                                                                                                          |
| `src/rules/fit.ts`                                                                  | `moveInLine`, fifth line of `checkFit`                                                                                                                                                        |
| `src/rules/letterPrompt.ts`, `letterValidate.ts`, `writeLetter.ts`, `fieldMatch.ts` | use the new shapes; move-in and relationship facts, rules and checks                                                                                                                          |
| `src/adapters/parse.ts`, `immoscout24/immoscout24.ts`                               | `parseAvailability`; the adapter fills `availability`                                                                                                                                         |
| `fixtures/immoscout24/listing-available-now.html`                                   | new: derived fixture with "sofort"                                                                                                                                                            |
| `src/storage/storage.ts`                                                            | `SCHEMA_VERSION = 2`, `MIGRATIONS[1]`                                                                                                                                                         |
| `src/ui/screens/profileForm/ProfileSections.tsx`, `draft.ts`                        | move-in choice control; relationship select                                                                                                                                                   |
| `src/ui/screens/ListingDetected/ListingDetected.tsx`                                | availability in the meta line                                                                                                                                                                 |
| `test-support/sample-profiles.ts`                                                   | new shapes; `coupleWithDog` gets `relationship: "partners"`                                                                                                                                   |
| `docs/decisions.md`, `PLAN.md`, `docs/ai-workflow.md`                               | ADR 10; PLAN's expected ADRs renumber to 11 and 12; profile fields beyond the brief; log lines                                                                                                |

---

### Task 1: Move-in becomes a choice in the stored profile

**Files:**

- Modify: `src/rules/types.ts`, `src/rules/profile.ts`, `src/storage/storage.ts`, `src/rules/letterPrompt.ts`, `src/rules/letterValidate.ts`, `src/rules/fieldMatch.ts`, `src/ui/screens/profileForm/ProfileSections.tsx`, `test-support/sample-profiles.ts`, `docs/decisions.md`
- Test: `src/rules/profile.test.ts`, `src/storage/storage.test.ts`, plus existing tests that reference `moveInDate` (`letterPrompt.test.ts`, `fieldMatch.test.ts`)

**Interfaces:**

- Produces:
  - `type MoveIn = { kind: "date"; date: IsoDate } | { kind: "asap" } | { kind: "flexible" }`
  - `Profile.moveIn?: MoveIn`, replacing `moveInDate`; `LetterRequest.moveIn?: MoveIn`, replacing `moveInDate`
  - `upgradeProfileV1(raw: unknown): unknown` in `src/rules/profile.ts`
  - `EXPORT_VERSION = 2`; `SCHEMA_VERSION = 2`
  - `moveInDateOf(moveIn: MoveIn | undefined): IsoDate | undefined` in `src/rules/letterPrompt.ts`, which returns the date only for the `date` kind

- [ ] **Step 1: Write the failing tests** (in `profile.test.ts`)
  - `it("reads each move-in kind")`: `parseProfile` with `moveIn` set to `{ kind: "date", date: "2027-03-01" }`, `{ kind: "asap" }` and `{ kind: "flexible" }` each returns `ok: true` with that value.
  - The existing date-problem test now uses `moveIn: { kind: "date", date: "2027-02-30" }` and expects `"moveIn.date: must be a date as YYYY-MM-DD"`. Add `moveIn: { kind: "soon" }`, which expects `"moveIn.kind: must be one of date, asap, flexible"`.
  - `it("upgrades a version 1 profile's move-in date")`: `upgradeProfileV1({ ...v1, moveInDate: "2027-03-01" })` equals the same object without `moveInDate` and with `moveIn: { kind: "date", date: "2027-03-01" }`. A profile without `moveInDate`, and a non-object, come back unchanged.
  - `it("imports a version 1 export and carries the move-in over")`: `importData(JSON.stringify({ kiezpigeon: 1, exportedAt, profile: { ...v1Profile, moveInDate: "2027-03-01" }, applications: [] }))` gives a `profile.moveIn` of `{ kind: "date", date: "2027-03-01" }`.
  - The existing export test now expects `kiezpigeon: 2`.

- [ ] **Step 2: Run them and see them fail**
      Run: `npx vitest run src/rules/profile.test.ts`. Expected: the new tests fail, because `moveIn` is unknown and `upgradeProfileV1` is not exported.

- [ ] **Step 3: Implement the change**
  - Add the types.
  - Read `moveIn` with the existing `Reader` (`object`, `oneOf` over `["date", "asap", "flexible"]`, `date`).
  - Add `upgradeProfileV1`.
  - In `importData`, accept versions 1 and 2, passing a version 1 profile through `upgradeProfileV1` before `parseProfile`. Any other version keeps the existing "unknown file version" problem.

- [ ] **Step 4: Storage migration test, then code**
  - In `storage.test.ts`, write `it("migrates a schema 1 profile's move-in date")`: store `{ schemaVersion: 1, profile: { ...coupleWithDogV1, moveInDate: "2027-03-01" } }` raw, then `read("profile")` gives `moveIn: { kind: "date", date: "2027-03-01" }` and the stored `schemaVersion` is 2. See it fail.
  - Then set `SCHEMA_VERSION = 2` and `MIGRATIONS[1] = (data) => ({ ...data, profile: upgradeProfileV1(data.profile) })`.

- [ ] **Step 5: Update the call sites, keeping behaviour the same**
  - `createLetterRequest` passes `moveIn`.
  - `letterPrompt.ts` and `letterValidate.ts` use `moveInDateOf(request.moveIn)` where they used `moveInDate`.
  - `fieldMatch.ts` returns `moveInDateOf(profile.moveIn)` for the `moveInDate` kind.
  - `ProfileSections` reads the date from `moveIn` and writes `{ kind: "date", date }`, or deletes `moveIn` when the field is cleared.
  - Sample profile: `coupleWithDog.moveIn = { kind: "date", date: "2027-03-01" }`.
  - In tests, replace `moveInDate` with the new shape. The `createLetterRequest` key-list test lists `moveIn`.

- [ ] **Step 6: Write ADR 10 in `docs/decisions.md`**
  - Title: "ADR 10: Move-in as a choice, the household's relationship, schema 2". Status Accepted. Add a row to the index table.
  - Context: a date-only move-in cannot say "as soon as possible" or "flexible", which are real landlord signals. The relationship part is added in Task 6.
  - Decision: the `MoveIn` union; storage schema 2 with `MIGRATIONS[1]`; export version 2, with version 1 still importing through `upgradeProfileV1`.
  - Rejected: a separate `moveInFlexible` flag next to the date, which allows contradictory "date and asap" states.
  - Consequences: older Kiezpigeon builds refuse schema 2 data (the existing newer-version guard), and the fill layer (Phase 5) gets a date only for the `date` kind.
  - Renumber the "Expected during the build" list in PLAN.md section 6: never-submit becomes 11 and fallback classification becomes 12.

- [ ] **Step 7: Verify**
      Run: `npm run lint && npm test`. Expected: all green.

- [ ] **Step 8: Commit**
      `feat(rules): move-in as a date, as soon as possible or flexible, stored at schema 2 (ADR 10)`

### Task 2: The adapter reads availability, including "sofort"

**Files:**

- Modify: `src/rules/types.ts`, `src/adapters/parse.ts`, `src/adapters/immoscout24/immoscout24.ts`, `src/rules/letterPrompt.ts`, `src/rules/letterValidate.ts`, `test-support/sample-profiles.ts`
- Create: `fixtures/immoscout24/listing-available-now.html`
- Test: `src/adapters/parse.test.ts`, `src/adapters/immoscout24/immoscout24.test.ts`

**Interfaces:**

- Produces:
  - `type Availability = { kind: "date"; date: IsoDate } | { kind: "immediately" } | { kind: "by_arrangement" }`
  - `Listing.availability?: Availability`, replacing `availableFrom`; the `missing` key becomes `"availability"`
  - `parseAvailability(text: string): Availability | undefined` in `src/adapters/parse.ts`
  - `availableDateOf(availability: Availability | undefined): IsoDate | undefined` in `src/rules/letterPrompt.ts`

- [ ] **Step 1: Write the tests** (the adapter tier is test-after, but write them now so they pin the parsing)
      `it.each` in `parse.test.ts`:

  | Input                 | Expected                               |
  | --------------------- | -------------------------------------- |
  | `"01.03.2027"`        | `{ kind: "date", date: "2027-03-01" }` |
  | `"ab 1.3.2027"`       | `{ kind: "date", date: "2027-03-01" }` |
  | `"sofort"`            | `{ kind: "immediately" }`              |
  | `"ab sofort"`         | `{ kind: "immediately" }`              |
  | `"Sofort"`            | `{ kind: "immediately" }`              |
  | `"nach Vereinbarung"` | `{ kind: "by_arrangement" }`           |
  | `"nach Absprache"`    | `{ kind: "by_arrangement" }`           |
  | `"bald"`              | `undefined`                            |

- [ ] **Step 2: Implement `parseAvailability`** (a date first, then `/sofort/i`, then `/vereinbarung|absprache/i`), and use it in the adapter for `.is24qa-bezugsfrei-ab`.

- [ ] **Step 3: Create the fixture**
      Copy `listing-complete.html`, set the `.is24qa-bezugsfrei-ab` text to `sofort`, and add a header line under the scrub mark: `<!-- derived from listing-complete.html: Bezugsfrei ab set to "sofort" -->`.

- [ ] **Step 4: Update the adapter tests**
  - The complete fixture now expects `availability: { kind: "date", date: "2027-02-01" }`.
  - The missing-fields fixture lists `"availability"` in `missing`.
  - New test `it("reads a flat that is free now")`: `listing-available-now.html` gives `availability: { kind: "immediately" }` and everything else as in the complete fixture.

- [ ] **Step 5: Update the call sites, keeping behaviour the same**
  - The prompt's "Frei ab" line and the move-in signal use `availableDateOf(listing.availability)`.
  - The validator's allowed numbers use the same function.
  - Sample listing: `availability: { kind: "date", date: "2027-03-01" }`.

- [ ] **Step 6: Verify and commit**
      Run: `npm run lint && npm test`, all green.
      Commit: `feat(adapters): read availability as a date, immediately or by arrangement`

### Task 3: Show availability on the Listing detected screen

**Files:**

- Modify: `src/rules/format.ts`, `src/ui/screens/ListingDetected/ListingDetected.tsx`
- Test: `src/rules/format.test.ts`, `src/ui/screens/ListingDetected/ListingDetected.test.tsx`

**Interfaces:**

- Consumes: `Availability` (Task 2)
- Produces: `formatAvailability(availability: Availability): string`

- [ ] **Step 1: Write the failing test** `it("words availability for the UI")`:
  - `{ kind: "date", date: "2027-03-01" }` gives `"Free from 01.03.2027"`
  - `{ kind: "immediately" }` gives `"Free now"`
  - `{ kind: "by_arrangement" }` gives `"Free by arrangement"`

- [ ] **Step 2: Run the test and see it fail; implement `formatAvailability`; run it and see it pass.**

- [ ] **Step 3: Add availability to the meta line**
      `metaLine` appends `formatAvailability(listing.availability)` when it is known. The ListingDetected test's meta expectation becomes `"Kreuzberg · 62 m² · 3. OG · Free from 01.03.2027"`.

- [ ] **Step 4: Verify and commit**
      Run: `npm test`, all green.
      Commit: `feat(ui): show when the flat is free on the listing screen`

### Task 4: Fit check compares availability with the applicants' move-in

**Files:**

- Modify: `src/rules/types.ts` (`FitRule` gains `"moveIn"`), `src/rules/fit.ts`
- Test: `src/rules/fit.test.ts`, `src/ui/screens/ListingDetected/ListingDetected.test.tsx` (fit lines go from 4 to 5)

**Interfaces:**

- Consumes: `MoveIn` (Task 1), `Availability` (Task 2), `formatAvailability` (Task 3)
- Produces: `checkFit` returns five lines in the order budget, income, pets, WBS, moveIn

- [ ] **Step 1: Write the failing tests**, one `it.each` over these exact pairs. "Listing" is the listing's availability, "Profile" is the profile's move-in, and status and reason are the expected result. The ±31 days rule: a profile date counts as close when it is on or up to 31 days after the listing date.

  | Listing         | Profile          | Status    | Reason                                                                         |
  | --------------- | ---------------- | --------- | ------------------------------------------------------------------------------ |
  | none            | any              | `unknown` | `The listing does not say when the flat is free.`                              |
  | date 2027-03-01 | none             | `unknown` | `Free from 01.03.2027. Add when you can move in to compare.`                   |
  | date 2027-03-01 | date 2027-03-01  | `ok`      | `Free from 01.03.2027, your move-in date.`                                     |
  | date 2027-03-01 | date 2027-03-20  | `ok`      | `Free from 01.03.2027, close to your move-in date 20.03.2027.`                 |
  | date 2027-03-01 | date 2027-02-15  | `warn`    | `Free from 01.03.2027, after your move-in date 15.02.2027.`                    |
  | date 2027-03-01 | date 2027-05-01  | `warn`    | `Free from 01.03.2027, more than a month before your move-in date 01.05.2027.` |
  | date 2027-03-01 | asap             | `ok`      | `Free from 01.03.2027. You can move in as soon as it is free.`                 |
  | date 2027-03-01 | flexible         | `ok`      | `Free from 01.03.2027. Your move-in date is flexible.`                         |
  | immediately     | asap or flexible | `ok`      | `Free now. You can move in right away.`                                        |
  | immediately     | date 2027-05-01  | `warn`    | `Free now. You want to move in on 01.05.2027; check the landlord can wait.`    |
  | by_arrangement  | any stated       | `ok`      | `Free by arrangement, so the date can be agreed.`                              |
  | by_arrangement  | none             | `unknown` | `Free by arrangement. Add when you can move in to compare.`                    |

- [ ] **Step 2: Run the tests and see them fail; implement `moveInLine(profile, listing): FitLine`; run them and see them pass.**
      Compute days between ISO dates with `Date.UTC` on the parts. That is pure: no clock.

- [ ] **Step 3: Update the ListingDetected test**
      It expects 5 fit lines. Check that the fit card's icon logic still gives a tick only for `ok`.

- [ ] **Step 4: Verify and commit**
      Run: `npm test`, all green.
      Commit: `feat(rules): fit check line comparing availability with your move-in`

### Task 5: Letters use as soon as possible, flexible and the listing's availability

**Files:**

- Modify: `src/rules/letterPrompt.ts`, `src/rules/letterValidate.ts`
- Test: `src/rules/letterPrompt.test.ts`, `src/rules/letterValidate.test.ts`

**Interfaces:**

- Consumes: `MoveIn`, `Availability`, `moveInDateOf`, `availableDateOf`

- [ ] **Step 1: Write the failing tests**
  - Facts line per move-in kind:
    - date: `"Gewünschter Einzug: 01.03.2027"` (unchanged)
    - asap: `"Einzug: ab sofort möglich"`
    - flexible: `"Einzug: beim Termin flexibel"`
    - none: no line
  - Listing line per availability:
    - date: `"- Frei ab: 01.03.2027"` (unchanged)
    - immediately: `"- Frei ab: sofort"`
    - by arrangement: `"- Frei ab: nach Vereinbarung"`
  - Strongest signals: asap gives `"Einzug ab sofort möglich"` and flexible gives `"Beim Einzugstermin flexibel"`. Both sit where the date signal sits now, after "Nichtraucherhaushalt ohne Haustiere".
  - The "gave no move-in date" system rule appears only when `moveIn` is undefined, so not for asap or flexible.
  - Validator: a letter saying "ab sofort" with `moveIn` set to asap has no problems (no numbers involved). The allowed numbers still include the parts of a `date` move-in and a `date` availability.

- [ ] **Step 2: Run the tests and see them fail; implement; run them and see them pass.**

- [ ] **Step 3: Commit**
      `feat(rules): letters say you can move in now or are flexible, and when the flat is free`

### Task 6: The applicants' relationship, honestly

**Files:**

- Modify: `src/rules/types.ts`, `src/rules/profile.ts`, `src/rules/letterPrompt.ts`, `src/rules/letterValidate.ts`, `src/rules/writeLetter.ts`, `test-support/sample-profiles.ts`, `docs/decisions.md` (amend ADR 10)
- Test: `src/rules/profile.test.ts`, `src/rules/letterPrompt.test.ts`, `src/rules/letterValidate.test.ts`, `src/rules/writeLetter.test.ts`

**Interfaces:**

- Produces:
  - `type Relationship = "partners" | "married" | "flatmates" | "family"`
  - `Household.relationship?: Relationship`. Absent means "don't mention".
  - `LetterProblemCode` gains `"relationship_invented"`
  - `createLetterRequest` drops `relationship` when there are fewer than two applicants

- [ ] **Step 1: Write the failing tests**
  - Parser:
    - `parseProfile` keeps each of the four values.
    - `relationship: "dating"` gives `"household.relationship: must be one of partners, married, flatmates, family"`.
  - Letter request:
    - `createLetterRequest(soloStudentWithRelationship, …)` has no `household.relationship`.
  - Prompt facts line, and the system rule it brings:

    | Relationship              | Facts line                      | System rule                                                                                                                                                          |
    | ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | partners                  | `"Beziehung: ein Paar"`         | `"- Say once, briefly, that the applicants are a couple. Do not describe either applicant's gender or call one the other's girlfriend, boyfriend, wife or husband."` |
    | married                   | `"Beziehung: verheiratet"`      | as partners, with "married" in place of "a couple"                                                                                                                   |
    | flatmates                 | `"Beziehung: Wohngemeinschaft"` | `"- Say once, briefly, that the applicants share the flat as flatmates."`                                                                                            |
    | family                    | `"Beziehung: Familie"`          | `"- Say once, briefly, that the applicants are family."`                                                                                                             |
    | none, with two applicants | none                            | `"- Do not say how the applicants are related to each other."`                                                                                                       |

  - Validator, `relationship_invented`. It matches a word that starts with `ehe` followed by `paar`, `leute`, `mann`, `frau`, `partner` or `gatt`, or a word starting `verheirat`, and flags it whenever the relationship is not `married`:

    | Text                             | Relationship | Expected                                               |
    | -------------------------------- | ------------ | ------------------------------------------------------ |
    | `"Wir sind ein Ehepaar."`        | partners     | `[{ code: "relationship_invented", text: "Ehepaar" }]` |
    | `"verheiratete Bewerber"`        | none         | flagged with text `"verheiratete"`                     |
    | `"Eheleute"`                     | married      | no problem                                             |
    | `"mehr"`, `"ehemalige Nachbarn"` | none         | no problem                                             |

  - `describeProblem({ code: "relationship_invented", text: "Ehepaar" })` gives `"\"Ehepaar\" says the applicants are married, but your profile does not."`

- [ ] **Step 2: Run the tests and see them fail; implement; run them and see them pass.**

- [ ] **Step 3: Sample profile**
      `coupleWithDog.household.relationship = "partners"`. The passing sample letter ("Mein Partner und ich") still validates, because only marriage words are checked; leave it.

- [ ] **Step 4: Amend ADR 10** with the relationship decision:
  - Optional, and only meaningful with two applicants.
  - Absent means don't mention, and the prompt forbids guessing.
  - Marriage words are validated.
  - Gendered wording is forbidden by the prompt only; the validator cannot know gender.
  - Rejected: a free-text field. It can't be validated, and it invites details landlords don't need.

- [ ] **Step 5: Verify and commit**
      Run: `npm run lint && npm test`, all green.
      Commit: `feat(rules): say how two applicants are related, and never claim marriage unasked (ADR 10)`

### Task 7: Profile form controls

**Files:**

- Modify: `src/ui/screens/profileForm/ProfileSections.tsx`, `src/ui/screens/profileForm/draft.ts` (only if clearing the relationship lives there)
- Test: `src/ui/screens/Onboarding/Onboarding.test.tsx`, `src/ui/screens/Settings/Settings.test.tsx`

**Interfaces:**

- Consumes: `MoveIn`, `Relationship`

- [ ] **Step 1: Move-in control**
  - In the "Move-in and budget" card: a `SegmentedControl` labelled `"When can you move in?"` with options `On a date` / `As soon as possible` / `Flexible`.
  - `On a date` shows the existing date field, labelled `"Move-in date"`.
  - With `moveIn` undefined, `On a date` is shown pressed with an empty date.

- [ ] **Step 2: Relationship control**
  - In the applicants section, only when there are two applicants: a `SelectField` labelled `"You are"` with options `Don't mention` (unset) / `Partners` / `Married` / `Flatmates` / `Family`.
  - Removing the co-applicant deletes `household.relationship` from the draft profile.

- [ ] **Step 3: Write the smoke tests**
  - Onboarding: after adding a co-applicant, picking `Married`, and on the household step pressing `As soon as possible`, the stored profile has `household.relationship: "married"` and `moveIn: { kind: "asap" }`.
  - Settings: removing the co-applicant removes `relationship` from the stored profile.

- [ ] **Step 4: Verify and commit**
      Run: `npm run lint && npm test && npm run build`, all green.
      Commit: `feat(ui): pick how you can move in and how you two are related`

### Task 8: Docs, QA in Chromium and the real-letter check

**Files:**

- Modify: `PLAN.md` (section 2 "Profile fields added beyond the brief": the move-in choice and the relationship), `docs/ai-workflow.md`

- [ ] **Step 1: QA in Chromium**
      With the built extension, at 320px and 400px:
  - The listing screen shows "Free from …", and "Free now" on `listing-available-now.html`.
  - The fit card has the move-in line.
  - The profile controls work by keyboard.
  - There is no horizontal scroll and no console messages.

- [ ] **Step 2: Real letters** (needs the author's key back in `.env.local`)
      Run the six acceptance letters on Sonnet with `coupleWithDog` as partners and with asap. Each letter:
  - states the relationship once, without gendered words;
  - states asap availability;
  - claims no marriage;
  - passes the validator, or shows its warnings.

- [ ] **Step 3: Log and open the PR**
  - Log what happened in `docs/ai-workflow.md`.
  - Run the full gate: `npm run lint && npm run typecheck && npm test && npm run build`.
  - Open the PR titled `feat(profile): move-in choice, listing availability and how two applicants are related`, with no AI attribution.
