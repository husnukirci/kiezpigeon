# AI workflow log

How this project is built with Claude Code, and where that went wrong.
One line per friction event, appended as it happens and never
reconstructed after the fact. The working agreement is in `CLAUDE.md`.

Format: `- <phase> | <what happened> | <what changed as a result>`.

## Friction log

- Planning | passform's CLAUDE.md mixes working rules with its stack (monorepo layout, NestJS, Drizzle, Tailwind, docker-compose); adopting "only the AI rules" meant separating them line by line rather than copying the file. | Kept rules 1 to 5 and the definition-of-done shape; replaced the stack invariants with stack-free product invariants and an explicit "open until ADRs 1 to 7 are accepted" section.
- Planning | The product brief's fit check needs a budget and a WBS flag, and every contact form asks for email and phone, but the profile scope listed none of them. | Added budget, WBS flag and contact details to the profile in PLAN.md, marked "to confirm" rather than silently assumed.
- Planning | A first draft of the letter validator promised to reject "names not in the facts", which no simple rule can check without false positives on ordinary German nouns. | Narrowed it to numbers and the salutation; the rest is the user's review, written into PLAN.md's risks.
- Planning | The brief's "Sent" status cannot be detected without watching the page's submit, which the never-submit rule makes undesirable to touch. | The tracker saves an application when the user confirms "Yes, I sent it" (Phase 7).
- Planning | The first drafts copied passform's heading style (title, em dash, subtitle), which broke this project's own "no em dashes in docs" checklist item; found by grepping the drafts against that item before showing them. | Headings use a colon; the em dash grep is part of the global checklist.
- P0 | Probe: WXT 0.21.5 with `@wxt-dev/module-react` 1.2.2 (Vite 8.3.5, React 19.3.1) builds an empty side panel on Node 24.19; first build had no `action` key, so the toolbar icon would not have opened the panel. | Added `action` to the manifest in `wxt.config.ts`; the Phase 0 review reads the built manifest.
- P0 | `npm view typescript` returned 7.0.2, but typescript-eslint 8.72 peers on `<6.1.0`; installing latest would have broken the lint gate. | Pinned `typescript@~6.0.3`; the TS 7 move waits for typescript-eslint.
- P0 | `chrome.*` did not typecheck (WXT ships `browser` from `wxt/browser`, no global `chrome` types), and the fake browser in tests only replaces the `wxt/browser` import. | Code imports `browser` from `wxt/browser`; auto-imports are off (`imports: false`) so every file shows its imports.
- P0 | The tokens staleness test crashed with "The URL must be of scheme file": under happy-dom, `new URL(..., import.meta.url)` uses the DOM's `URL`, not Node's. | The test runs in Vitest's `node` environment via a file docblock; checked that it fails after editing `tokens.json` and passes after `npm run tokens`.
- P0 | Probe: throwaway files in `src/rules/`, `src/adapters/`, `src/storage/` and `src/claude/` broke each ADR 6 boundary once; ESLint reported all ten violations and nothing in the allowed files. The first type-aware lint run also flagged every CSS module class as `string | undefined` (noUncheckedIndexedAccess). | Probe files deleted; class names go through a small `cx()` helper instead of template strings.
- P0 | CI went green on its first run, so the gate had not yet been seen failing. | Pushed a throwaway branch with one changed colour in `tokens.json` and no regeneration; CI failed in `npm test` on the staleness test, as intended. Branch deleted; nothing of it is in this PR's history.
- P0 | Self-review found that the generated token test hardcoded `#12175a`, so it would fail on any real design system update even after `npm run tokens`, mixing up "stale" with "changed". | The shape test now matches patterns; only the staleness test compares the committed file, and it was re-checked to fail on a change and pass after regeneration.
- P1 | Probe: Node 24's full ICU formats `de-DE` EUR as `1.180\u00a0€` (no-break space), so a test comparing against `Intl` would disagree with the spec's `1.180 €` on whitespace alone. | `format.ts` groups by hand with a plain space; the format suite runs twice, once with `Intl` stubbed out, and asserts the stub took effect.
- P1 | Probe: the Phase 0 boundary rule rejected `vitest` and `../../test-support/` in a throwaway `src/rules/*.test.ts`, so the strict-TDD tests could not have been written inside the boundary. | A test-file override allows exactly those two; a probe import of `../ui/cx` from a rules test still fails lint.
- P1 | The spec gives exact reasons for most fit branches but none for "rent cannot be worked out" or "no Kaltmiete". | Chose `Rent not shown` and `Kaltmiete not shown`, pinned by tests and flagged in the PR for the author to confirm.
- P1 | A first version of `parseProfile` read applicant items lazily in the return object, so problems came out in a different order than the profile's fields; the order test caught it. | Readers run strictly in field order.
- P1 | Prettier rewrote the test's `"\u2014"` escape into a literal em dash, which the global em dash grep would flag. | The test builds it with `String.fromCodePoint(0x2014)`; the prompt itself names U+2014 instead of containing it.
- P1 | Spec conflict: the prompt's signal list includes "non-smoking household without pets", which invites "keine Haustiere", but the validator rule "no pets → no pet keyword appears" would reject that honest sentence. | A pet word with `kein…` or `ohne` among the two words before it counts as a denial, in both directions: it neither satisfies `pets_missing` nor triggers `pets_invented`. Pet words match word endings so `Hunderten` is not a dog. Tested.
- P1 | My hand-counted word totals in two validator tests were wrong (15 and 184 instead of 16 and 186); the code was right. | Expectations corrected from the actual counts; the fixture letter's 150 is asserted by `countWords` in the test itself.
- P1 | The em dash grep found a literal U+2014 in the validator's own dash regex after it was committed (the escape had become the character). | The pattern is built with `new RegExp(String.raw...)` so the source holds only the `\u2014` escape; fixed in a follow-up commit, tests unchanged and green.
- P1 | The spec lists `salutation` as a field kind but the profile has no salutation, so a Frau/Herr select can never count toward X. | Left unmatched rather than adding a stored field outside an ADR; proposed for Phase 2 in the PR.
- P1 | A field labelled `Nichtraucher` means the opposite of `smoker`; mapping the household's `smoker: false` onto it would have unticked a true statement. Caught while writing the field table, before the code. | `mapFields` inverts the value for non-smoker fields; tested with `Nichtraucher`, `nonSmoker` and `Raucher`.
- P1 | The key-leak test used a fake value starting `sk-ant`, which the global grep for keys would flag forever. | Replaced with a `FAKE-KEY` marker; `grep -rn sk-ant src test-support` is empty.
- P1 | Mutation check (acceptance): `rent <= budget` to `<` broke 2 tests, the 10% edge `<=` to `<` broke 1, income `>= 30` to `> 30` broke 1, removing `em_dash` broke 2, removing `wrong_salutation` broke 3, the 7-day `<` to `<=` broke 2, giving consent fields `true` broke 2. The first consent mutation silently did not apply (sed missed the formatted line), which was only noticed because nothing failed. | Re-applied with an exact replacement and a `git diff --stat` check before running.
- P1 | Self-review: a contact person with a blank surname made `salutationFor` return `Guten Tag ,` and the validator's `includes("")` accept any first line. | `namedContact` treats a blank surname as unknown in both; two tests seen failing first.
- P2 | The first two commits carried a `Co-Authored-By` trailer, which the author's global instructions forbid; noticed right after committing. | Rewrote both unpushed messages; every later commit was checked before pushing.
- P2 | Spec gap: ADR 3 names a `settings` key, but no setting exists until Phase 4's model choice, so a validator would guard an empty object. | Storage types only `profile` and `applications`; Phase 4 adds `settings` with its first field. Flagged in the PR.
- P2 | Spec gap: the acceptance run (delete all, then import) needs import while onboarding shows, but the spec puts import only in settings, reached from the profile. | The header settings button works during onboarding and shows only the data card there.
- P2 | Design conflict: the Chip README gives 40px chips, under CLAUDE.md's 44px tap minimum; a first draft "met" it with margin, which does not enlarge the hit area. | Pressable chips use `min-height: var(--tap-min)`; the CSS comment names the conflict.
- P2 | Putting the Stepper tiles inside the Household card would have drawn `night-700` on `night-700` (invisible tiles) and nested cards, which the Card README forbids. Caught while laying out the step, before the screenshot. | Stepper tiles sit on the panel in their own grid; the toggles and pet kind stay in a card.
- P2 | The form rules (`parseEuroInput`, `centsToEuroInput`, `profileProblems`) were not in the spec but belong in the strict-TDD core; red was seen as one batch (module missing), not one cycle per rule. | Kept in `src/rules/profileForm.ts` with 25 tests; noted here instead of claiming per-rule cycles.
- P2 | Storage tests passed on the first run, so they had not been seen failing. | Mutation check: `clear()` swapped for removing only `profile`, and `writeAll` storing the raw value, broke one test each.
- P2 | The Settings smoke test caught a real bug: the import confirm passed the whole flow state (with its `step` field) to `writeAll`, which tried to validate a `step` key and threw `PARSERS[key] is not a function`. | `writeAll` iterates known keys only (new storage test) and the confirm passes just profile and applications.
- P2 | A drafted Settings screen called a placeholder function that did not exist; the typecheck would have failed. Spotted while rereading before running it. | Sections render only when a draft exists.
- P2 | QA: Playwright 1.57 wanted Chromium build 1200; only 1248 was cached. | Pointed `executablePath` at the cached build in a throwaway scratchpad script (not committed): onboarding by keyboard at 320px, restart, export, delete all (`{}` in storage), import gave an identical profile, no console errors, no horizontal scroll at 320 or 400px.
- P2 | QA screenshot: a wrapping error message squeezed its exclamation icon. | Icons get `flex-shrink: 0`.
- P3 | Probe: ImmoScout24 answered the automated test browser with its "Ich bin kein Roboter" page (HTTP 401). | Stopped there; no attempt to get past it. The author saved the pages from their own Chrome session instead.
- P3 | Scope: the author offered a deutsche-wohnen.com listing as a fixture; that is a second site, which CLAUDE.md puts in Tier 2. | Asked; the author kept Phase 3 on ImmoScout24 and deutsche-wohnen.com joined the Tier 2 adapter candidates.
- P3 | Probe: on a saved exposé the values sit in `is24qa-*` classes (`kaltmiete`, `nebenkosten`, `gesamtmiete`, `wohnflaeche-ca`, `zimmer`, `maincriteria-*`) and `data-qa` attributes (`expose-title`, `is24-expose-address`, `contactName`). The same facts are in an `ld+json` block and a tracking `keyValues` object. The contact form is not in the DOM until "Nachricht" opens a dialog. | The adapter reads only the visible attributes (ADR 8); the dialog is a Phase 5 note.
- P3 | Probe: happy-dom 21.0.4, the latest, stops parsing at a `<style>` inside an inline `<svg>`. The site's logo has one, so 213 elements of a 4 MB page parsed and every selector came back empty, with no error. | The fixture reducer drops inline SVG; the adapter test asserts the contact name near the end of the page, so a truncated parse fails it.
- P3 | The saved page carried the author's own name and customer number in the signed-in site header, which the scrub list (contact names, phones, emails, addresses, ids) did not name. Found by reading the reduced page's text, not by the pattern check. | `scripts/reduce-fixture.ts` drops the header, footer, menus, ad targeting and tracking ids; the real-to-invented replacement list stays outside the repo.
- P3 | Spec gap: `readListing(document): Listing` cannot say "not a listing" and has no URL for `Listing.url`; the sample listing named missing fields `kaltmiete` while the type says field names. | ADR 8: `readListing(document, url): Listing | undefined`; `missing` holds `Listing` keys and the sample was aligned.
- P3 | Messaging tests passed first time; a mutation removing the error branch still passed, because the throwing handler threw synchronously and the fake browser rejected for a different reason. | Handlers run inside a promise so a throw answers with an error; the mutation now fails the test.
- P3 | During a mutation check, `git checkout` could not restore the file because it was not tracked yet; it was recovered from a backup copy taken just before. | Mutation checks copy the file to the scratchpad first.
- P3 | Fake browser: `tabs.query` throws after `reset()` (no current window), and `vi.spyOn` picks the callback overloads typed `void`. The App test also showed a failed tab lookup would leave the panel on "loading" forever. | Tests stub `tabs.query`; the hook treats a failed lookup as not a listing (test added).
- P3 | QA in Chromium: the reducer stripped every `<meta>`, so a fixture served to the browser decoded as Latin-1 and the title showed mojibake; the unit tests read the file as UTF-8 and passed. | One `<meta charset="utf-8">` is kept.
- P3 | QA at 320px: `750 €` broke the euro sign onto its own line in the stat tiles. | Tiles never break their value and wrap to two columns below the 400px width.
- P3 | Probe (second page): floor (`is24qa-etage`, `1 von 5`), move-in date (`is24qa-bezugsfrei-ab`), pets (`is24qa-haustiere`, `Ja`) and year built (`is24qa-baujahr`) are visible attributes; features are tags under `#is24-boolean-criteria` with `data-qa="is24qa-balcony-label"` and similar. The contact was a company, and neither page nor its tracking data had any WBS field. | WBS is read from a row labelled Wohnberechtigungsschein or WBS, tested on invented markup and flagged in the PR; a company contact is not greeted by name.
- P3 | QA at 400px: `1.028,29 €` overflowed its stat tile; the 320px fix had assumed whole-euro rents. | Tiles are at least as wide as their value and share the row; the third wraps when needed.
- P3 | The fixture leak check missed `Hellersdorfer Straße 91` on the search page: its street pattern only knew `…straße 12` written as one word. Seen while reading the page text, not from the check. | The pattern covers a separate `Straße`, `Allee` and the rest; all three fixtures were rechecked with it.
- P3 | The search page held 24 result cards with real addresses. | It was trimmed to two cards before scrubbing (noted in its header); the test asserts both cards parsed.
- P3 | The reducer's own key pattern contained the literal `sk-ant`, which the global key grep would flag, the same trap as in Phase 1. | Spelled `sk-[a]nt`.
- P3 | `npm run lint` reported 78,319 errors, all in the raw saved pages' downloaded scripts inside the ignored `kp-fixtures/` folder. | Linted with that folder excluded; the raw pages are deleted after the PR. CI never sees them.
- P3 | Live check: the author's first listing tab showed nothing until a reload, because it was open before the unpacked extension was loaded, so it had no content script (the ADR 8 consequence). A newly opened listing worked straight away. | Kept as is in this phase; injecting the script on demand needs the `scripting` permission, proposed for Phase 6 where it arrives with an ADR.
- P4 | Probe (ADR 4): a throwaway MV3 extension in Playwright's Chromium called `POST /v1/messages` from its service worker with the author's key read from an ignored `.env.local`. With `x-api-key`, `anthropic-version: 2023-06-01`, `content-type` and `anthropic-dangerous-direct-browser-access: true`, Sonnet 5.5 and Haiku 5.5 both answered 200 in about 1.5 s. Without the browser-access header the answer is 401 `authentication_error` with a CORS message; a wrong key is 401 `invalid x-api-key`. | The client always sends the header (the SDK's `dangerouslyAllowBrowser`), and a 401 maps to "check your key" only because the header is never missing. The key was never printed; `.env*` was gitignored before the file existed.
- P4 | The client test expected `x-api-key` (what the fetch probe sent) and failed: SDK 1.x sends the key as `Authorization: Bearer` and pins `anthropic-version: 2026-10-21`, neither of which the first probe had tried. | Re-probed from the service worker with the SDK's exact headers (200 on both models, 401 `Invalid bearer token` for a wrong key) before trusting it; the test asserts what the SDK really sends.
- P4 | A hand-counted word total in a retry test was wrong again (13 instead of 14), the same slip as in Phase 1. | The test computes the count with `countWords` instead of a literal.
- P4 | First real run through the built service worker (Sonnet 5.5, six letters): every letter landed between 118 and 137 words, and the short-tone letter was still 118 after its retry. The Phase 1 prompt told the short tone to "stay near the lower end", which pushed it under the floor. | Prompt reworded test-first: each tone names a target well inside the range (warm and formal 150, short 140); "lower end" is gone.
- P4 | Spec gap: Phase 1 made 1 or 2 chosen features a hard rule (`RangeError`), but Phase 3's screen promises a letter for a listing that names no features, so that letter could never be built. | `assertFeatureCount` takes the listing and allows none only when the listing names none; tests seen failing first. "Write my letter" is disabled with a hint when a listing has features and none is picked.
- P4 | Design conflict: the Card README gives the letter card a 1.55 line height, which is not a token, and stylelint rejects raw line heights. | The letter uses `type-body-sm` (21px, 1.5); the CSS comment names the gap.
- P4 | The side panel renders in React `StrictMode`, which runs mount effects twice in development; a letter requested from an effect would have been two billed calls. | Every request starts in a click handler (`useLetter().write`); a Home test asserts no message before the click and exactly one per click.
- P4 | The SDK made the service worker bundle 362 kB (it was a few kB). | Accepted for typed errors and version tracking (ADR 4 implementation note); flagged in the PR.
- P4 | QA at 320px: the edit textarea had a fixed minimum height, so editing a 150-word letter meant scrolling inside the paper. | `field-sizing: content` lets it grow with the letter.
- P4 | QA script: reading the clipboard back failed in headless Chromium (`NotAllowedError`), which first looked like Copy failing. The extension's write had succeeded. | The script records what `writeText` receives instead: the exact letter, 905 of 905 characters.
- P4 | Acceptance with Haiku 5.5: two of six letters were still too short after the retry, because the retry only said "it needs 120 to 180". | `describeProblem` now names how many words to add or cut to reach the middle (test first); Haiku then passed five of six, and the sixth reaches the screen with that warning (ADR 9).
- P4 | Why Sonnet letters needed the retry (first attempts checked directly): short-tone letters undershooting the length, and the model rounding the listing's 51,44 m² to "51,4", which the validator rejects as a number not in the facts. | Kept strict: a rounded fact is not the fact. The retry fixes both; every final Sonnet letter passed.
- P4 | Reading the acceptance letters: the student profile has no move-in date, yet both her letters said the listing's date "passt für mich". The date is a listing fact, so the number check passed; the claim was invented. | A prompt rule (test first) forbids a move-in claim when the profile gives no date; the rerun's student letters make none. Prose claims stay outside what the validator can check (PLAN.md risks).
- P4 | Tuning the short tone, which undershoots the 120-word floor (first attempts 101 to 132): rewording it as "direct and plain", raising effort to medium, and raising the targets to 155 and 160 each left first attempts at about 107 to 142. | All three reverted uncommitted; the retry with "Add about N words" and the on-screen warning (ADR 9) carry it. The final acceptance run is reported as it came out, not rerun until clean.
- P4 follow-up | Model comparison on the six acceptance letters (one run each): Opus 5.5 passed all checks on the first call (about 2.7 cents, 12 s); Fable 5.1 needed two retries for six passes (3 to 14 cents, up to 25 s) with no visible gain over Opus; Sonnet 5.5 passed six with one retry; Haiku 5.5 passed four. One Haiku letter was flagged `pets_invented` for "Haustiere haben wir keine": the pet check only looks for a negation before the pet word. | Opus and Fable added as settings at the author's request (ADR 4 amendment). The negation-after case is a validator false positive, proposed for the next phase's rules work.
- P4 follow-up | QA at 320px: the first select labels carried cost and speed ("Fable 5.1: most capable, up to 15 cents") and were cut off; the settings intro still said "usually a cent or two", false for Opus and Fable. | Short names in the select, the trade-off in a hint line below for the picked model, and the intro says the model sets the price.
- P4 follow-up (move-in and household) | Plan written and run inline (superpowers writing-plans, executing-plans). Rulings on the way: PHASES.md also numbered the planned ADRs and was renumbered with PLAN.md; the plan's fit reasons all ended with a full stop, but the existing lines use none for one clause, so the existing style won. | Recorded in the plan's ledger and the PR.
- P4 follow-up | A schema 1 store can hold an API key with no profile yet (onboarding saves the key first). The migration would have written `profile: undefined`, and the storage test could not show it because the fake storage drops undefined values. | The test checks the pure migration step's output instead; it failed first, and the step now leaves such a store alone.
- P4 follow-up | QA at 320px: "As soon as possible" spilled out of its segmented button (three options at about 73 px each). The unit tests could not see it. | Labels became "A date / Now / Flexible" under the question "When can you move in?".
- P4 follow-up | The whole-branch review (a fresh Opus reviewer; Fable hit its usage limit mid-review) found three gaps in "letters claim nothing the profile lacks": a crafted one-applicant import kept `married`, which a later co-applicant would inherit; the marriage check was anchored at the word start and missed "Akademikerehepaar", "Lehrer-Ehepaar", "Ehe", "geheiratet", "Hochzeit" and "Gattin"; and the family and flatmates rules let the model write "meine Schwester". It also showed an older signal saying "Einzug zum 15.02.2027, passend zum Bezugstermin" for a flat free from 01.03. | All four fixed test-first in one pass; the move-in signal and the fit line now share `isCloseMoveIn`. Six minor findings deferred to the PR.
- P4 follow-up | Real letters (Sonnet, the six acceptance letters, once with the couple's date and once with Now): every couple letter said "Wir sind ein Paar" exactly once, with no gendered word and no marriage claim; "ab sofort einziehen" appeared only with Now, while "sofort" in the date letters was about sending documents. One student letter ended at 115 words with its warning. | Recorded in the PR.
- P4 follow-up | A commit header over 100 characters failed the commitlint hook, and the next command in the same chain committed the staged source fixes under a "docs:" message. | The unpushed commit was undone with a soft reset and redone with the right message; chained commands now stop at a failed commit.
- P4 follow-up (panel per tab) | The author noticed the panel followed them from a listing tab into YouTube: it was opened window-wide (`openPanelOnActionClick` and one global panel). Probe in Chromium: with `sidePanel.setOptions({ enabled: false })` globally and `setOptions({ tabId, path, enabled: true })` for one tab, `getOptions` reports the panel enabled only for that tab, with its own path; `sidePanel.open` exists. Headless Chromium cannot show the panel, so the visible hide-and-return on a tab switch needs the author's own Chrome. | The icon click switches the panel on for its tab only and opens it there; the panel learns its tab from its path. ADR 8 amended.

- P5 | The automated browser is still blocked by ImmoScout24, so the author pasted the open "Nachricht" dialog's markup from their own signed-in Chrome. It held their name, email, phone and street prefilled from the account, and the agent's name. | The fixture was written by hand from it with invented values (`fixtures/immoscout24/contact-form.html`, derived from `listing-complete.html`); a grep for each real value in the fixture is empty. The paste itself was never written into the repo.
- P5 | Probe (ADR 11): the dialog is React (`:re:` ids from `useId`, CSS module class names). With React 19 in happy-dom and controlled fields, `el.value = x` plus an `input` event changed the DOM but left React's state empty, for inputs and selects alike: a fill that looks right and is lost on Send. The prototype's native `value` setter followed by `input` or `change` was accepted for text, textarea and select. The author's console check on the live page did not come back with the paste. | Fill uses the native setter and fires `input` then `change`; the probe is kept as a running test, and the live acceptance run confirms it on the site.
- P5 | The real form has 7 selects (Anrede, Einzugstermin, Haushaltsgröße, Haustiere, Beschäftigungsart, Einkommen in ranges, Bewerbungsunterlagen), three pre-ticked opt-in toggles (profile visible, follow the agent, Umzugsfirmen offers) and labels not tied to the selects by `for`. The Phase 1 matcher only produced raw values (`true`, cents, a date) and counted consent fields toward Y. | Spec gap: `FormField` gains options and the current value, the matcher picks an option per kind, and opt-in checkboxes are left alone and not counted (ADR 11).
- P5 | A shell step hung for two minutes on a stray `cat >> file` with no input, left in a chained command; nothing had run past it. | Stopped and rerun without it.

- P5 | Reading the Phase 1 matcher before filling with it: a text field labelled `Beruf` would have received the code `permanent`, and `Nettoeinkommen` the cents `460000`; the tests pinned both, because Phase 1 values were never meant to be written into a page. | Values are now ready to write (the job, whole euros, a German date); the old expectations were changed test-first. 14 new or changed tests seen failing, then green in one pass, so the pass was not taken as proof.
- P5 | Mutation check on the new matcher code: `>` to `>=` on the income range and dropping the `!NO` guard (so `Nicht vorhanden` reads as yes) both survived, because every test listed options in ascending, yes-first order and `find` stopped at the right one by luck. | A test with the options reversed kills both; the opt-in, replaces and WBS-documents mutants failed tests from the start.

- P5 | Mutation check on `fillForm`: adding `requestSubmit()`, `submit()`, a button click, a synthetic Enter, a plain assignment instead of the prototype setter, or dropping the consent or file guard each failed at least one test. | Recorded for the PR; the never-submit test is the one that fails if a submit is introduced.
- P5 | The commit hook's lint rejected the React probe test: the ADR 6 boundary forbids React anywhere in `src/fill/`, tests included. | Adapter and fill tests may import React and Testing Library to stand in for a page; a probe import of `src/ui/` from a fill test still fails lint.

- P5 | First e2e run: `getByRole("dialog")` matched six elements, because the exposé page carries popovers and a map with `role="dialog"`. The adapter was not affected (its selector needs the contact form inside the dialog). | The test names the dialog (`Kontaktanfrage`). Playwright's `context.route` also caught the service worker's Claude call, so the run needs no key and no network.
- P5 | Mutation check (acceptance): `form.requestSubmit()` and `form.submit()` added to the content script's fill handler each failed the e2e run, but first on a field value, because the sent form reloaded the page. | The "nothing was sent" checks now run first; the failure names the second page load and shows the query string the form would have sent.

- P5 | Branch review (a fresh reviewer agent, no shell) found no submit path but seven real gaps: fill trusted the plan's `kind`, so a step calling an opt-in `pets` would have ticked it; `mobil` matched inside `Immobilie` (phone number into a message field); radios counted but never filled; `ab`/`bis` matched inside words in income labels; describe read hidden, file and password values; duplicate names made two fields share a key; the recorders missed focus, keyup, keypress, reset and non-button clicks, and the e2e highlight click was conditional. | All fixed with tests seen failing first; the opt-in guard was mutation-checked. Not changed: React checkboxes listen to `click`, which fill never sends; already a consequence in ADR 11, and ImmoScout24 asks those questions as selects.

- P5 | Live acceptance on a German exposé in the author's Chrome (the English-site miss is logged on the follow-up branch): the card showed 13 of 15 matched, with Anrede and Bewerbungsunterlagen left for the user and three account-prefilled fields named as replaced; after Fill the form the author reported the result looked good, the form unsent. | Recorded in the PR as the author's report; the detailed checks (values stick after focus, no console errors) were asked for and summarised by the author as good, not observed by me.
- P5 | The live card named Telefonnummer as replaced, though most likely only the format differed (`+49 …` on the account, `0…` in the profile). | Phone values are compared as digits with `+49` and `0049` read as `0`; test seen failing first.
- P5 follow-up (natural letters) | The author asked for plainer letters without stock phrases, income as the form's band instead of exact sums, and an employment option for someone between jobs. Asked two questions first (how to show income, how to model the job search); the answers were the form's bands and a new option. | `incomeBand`, `incomeRatioPhrase`, `job_seeking` and the tone rules, all test-first; ADR 10 amended.
- P5 follow-up | Real letters, round 1 (Sonnet, five cases): all passed the validator and none used a listed cliché, but they swapped the clichés for self-praise ("zuverlässig", "ruhigen, gepflegten Zustand") and fit claims ("passt gut zu unserem Alltag") that no fact supports. | A prompt rule against praising the applicants or claiming fit, test-first.
- P5 follow-up | Round 2: the filler was gone, and the student letter instead offered a Bürgschaft and an Immatrikulationsbescheinigung and said the rent was over her income. An invented offer is worse than filler. | A rule against offering anything outside the facts or commenting on affordability, test-first. Round 3 (student, three tones): no invented offers, but two of three letters stayed under 120 words after the retry, because a sparse profile now has little left to say. Reported to the author as a trade-off, not tuned further.

- P5 | Live check: the author's listing showed "Ready when you are" after every reload. The tab was ImmoScout24's English site (`/en/expose/<id>`); the content script matches only `/expose/*`, so nothing answered. The e2e run passed throughout, because it serves the fixture at the German address. A console check on the tab found it. | Live check moved to the German address. Supporting `/en/` needs English fixtures (labels and values are translated) and is proposed as a follow-up, together with a panel message that tells "unsupported page" from "not a listing".

- P5 follow-up | After the band was built, the author changed the income wording: the form's top band is "> 5.000 €", which undersells a higher income, so the letter now rounds down to whole thousands ("über 6.000 €") and ignores the form's bands. | `incomeBand` became `incomePhrase`, test-first; the form's select keeps picking the site's own band. The earlier line above stays as written.

- P5 follow-up | A real letter on a live listing: natural and honest, but it overstated the income ratio ("deutlich") and repeated the size and floor back to the landlord, rounding the size, which the validator flagged. | Two prompt rules, test-first: the ratio exactly as given, and no listing facts repeated except the chosen features and a move-in signal. Three real letters on a similar invented case: neither problem came back; the short tone ended at 117 words after the retry, and the warm letter added an invented detail ("Morgenkaffee" on the balcony). Both reported to the author, not tuned further.

- Follow-up (short closing) | The author asked for a shorter closing paragraph after reading their latest letter. | A prompt rule for one closing sentence, test-first. Three real letters (Sonnet, an invented two-person case): every closing was the single sentence, all passed, but all three needed the retry because the first draft was under 120 words (final 121 to 130). Each letter now costs two calls; reported to the author together with the 120-word floor.

- Follow-up (letter length) | The author's next real letter padded to reach 120 words with invented hobbies ("Wir kochen gern und sitzen abends gern draußen") and a rent comment the prompt forbids. The author lowered the minimum to 100. | Real runs then showed first drafts at 83 to 94 words with a target of 125, and still 77 to 99 with a target of 140: the no-filler rules, not the target, set the length, and every letter still went to the retry, which kept padding ("Das sagen wir Ihnen offen", "Er bringt Erfahrung in der Führung mit"). Asked again with the numbers; the author removed the minimum. Five real letters afterwards: all passed on the first call, 52 to 96 words, no padding.
- Follow-up (letter length) | One of those runs flagged "Haustiere haben wir keine." as invented pets: the false positive logged in the P4 model comparison, never fixed. | The validator reads a `kein…` up to three words after a pet word as a denial when it ends the clause, and not when it goes on ("Hund hat keine Probleme"); both cases tested first.

- Follow-up (names once) | The author's next real letter named both applicants three times: in the opening, in the job lines and in the sign-off. | A prompt rule keeps names out of the opening sentence, test-first. Five real letters: no opening sentence held a name (a first check counted the whole first paragraph, which in three letters also held the job lines, and so over-reported); all passed on the first call.

- P6 | Probe (ADR 12): a throwaway MV3 extension with `activeTab` and `scripting` and no host permission, in Playwright's Chromium. Its extension page could not `scripting.executeScript` into a page tab ("Cannot access contents of the page"). CDP `Extensions.triggerAction` stands in for the icon click, but only fires on the focused tab: aimed at a background tab by `targetId`, it clicked the extension's own page instead, until the site tab was brought to front. After that click the extension page could inject into the tab, also after a same-origin navigation and back; a cross-origin navigation revoked it. | The fallback injects from the panel on the user's button, under the grant the icon click gave; the panel says to click the icon again when the grant is gone. The e2e run can grant it the same way, so the fallback gets its own never-submit run.

- P6 | My first commit carried a Claude co-author trailer from the session's default commit guidance, which the author's global instructions forbid. Caught before pushing. | Amended away; no later commit has it.
- P6 | While mutation-checking the spam-trap test I restored `describe.ts` with `git checkout`, which also threw away the uncommitted visibility change the test was about. | Re-applied and re-run; mutations are now restored from a scratch copy, as for `wxt.config.ts` and `fallback.ts` later in the phase.
- P6 | The e2e probe asked a page-level CDP session for `Extensions.triggerAction` and got "Method not allowed"; the throwaway probe had worked only because it had happened to open a browser-level session. | The spec opens `context.browser().newBrowserCDPSession()` and says why.
- P6 | The first full e2e run waited 60 s per test for "Use this page", because `.output/` was built before the UI commits; running `playwright test` directly skips the build. | Re-run through `npm run test:e2e`, which builds first. Mutation check: a `requestSubmit()` in the fallback's fill handler failed both generic runs; removing `activeTab` failed the probe.

- P6 | Branch review (a fresh reviewer agent, read-only) found no submit path and confirmed preview and fill share one mapping, but six real gaps: typed facts and the letter survived a page load in the tab, so a fill could write one page's letter into the next page's form; the fill re-picked the form at click time, so a dialog opened in between could take values by colliding keys; on an ImmoScout24 exposé the injected reader would have answered and filled beside the content script; opt-outs survived a change of the form's keys; the toggle list sat inside the live region; a duplicated grid. | All fixed, each with a test seen failing first. My first test for the double answer passed without the fix (the content script's answer wins either way, but both listeners act), so it now asserts the page field stays empty, and fails without the marker. A first test for resetting opt-outs only re-rendered from scratch and was replaced by a rerender with changed keys.
- P6 | Live check of the built extension on a real non-ImmoScout listing (Deutsche Wohnen), scripted Chromium, icon click via CDP, panel opened as a tab, letter stubbed locally. | The flow worked: 5 of 5 pairs, an opted-out phone stayed empty, no submit, POST or navigation, no console errors. The site renders the listing and its form twice after its cookie banner is answered; the fill took the first copy. Its two income dropdowns are hidden natives behind styled ones, so the card leaves them out without a "Fill these yourself" line: proposed as a Tier 2 follow-up, not built.

- P7 | The design system has no drawing of screen 4, only the README's one-line list (stat tiles, filter chips, rows with pills, a pigeon tip) and the component previews; the PanelHeader README has a Settings button only, so the tracker had no way in. | Built from the README, the Card preview's tiles (Sent, Viewings, Waiting) and the filter tab preview; a "Your pigeons" icon button sits beside Settings, named in the PR as a deviation for the author to accept or move.
- P7 | Probe: the acceptance needs applications to survive closing Chrome. A Playwright run on a profile directory of its own stored three, closed Chromium, opened it again on the same directory and read them back (the unpacked extension keeps its id). | Kept as `e2e/tracker.spec.ts`. Mutation check: seeding `storage.session` instead, which a restart clears, failed it with 0 sent.
- P7 | Imports are untrusted, and the tracker renders `listingUrl` as a link; `parseApplication` accepted any text, so an edited export could carry a `javascript:` link into the panel. | The validator accepts only http(s) addresses with a host, test-first.
- P7 | Opening Settings or the tracker from the header unmounted home, so a letter already written (one or two paid calls) was gone on return; true since Phase 4 for Settings, and the tracker made the trip routine. | Home stays mounted under a `hidden` wrapper, test-first. My first version returned early while the profile loaded and dropped the header, which the existing App tests caught.
- P7 | Item 3 (export, import, delete all) was already built in Phase 2, but every screen test used an empty application list, so it would have passed with applications dropped. | The three Settings tests now carry an application each.
- P7 | Two test helpers (unit and e2e) found a stat tile by its label and also matched the Sent pill. | Both look for the stat-sized number above the label.
- P7 | I built the tracker screen (item 2) before "Did you send it?" (item 1), so the saved record had somewhere to show; the phase asks for the list in order. | Noted here and in the PR; no other effect.
- P7 | Branch review (a fresh reviewer agent, read-only, without a shell) found three real gaps: my URL check tested only the prefix, so an imported `http://[bad` passed and its row would throw while rendering and blank the panel; the previous fill's report stays on screen while a new fill runs, so a second fill that wrote nothing could save a letter that never reached the form; adding and changing applications read then wrote with nothing in between, so two quick changes lost one and a double "Yes" could save twice. | All fixed, each with a test seen failing first: the validator parses the address, a fill click remembers the report it saw, and changes to the list run one at a time with one application per listing. Also took its copy note: the first tip names the "Did you send it?" card.

- P8 | Scrub: tree, every historical version of the fixtures and all commit messages came back clean for emails, phone shapes, street patterns, ids and keys (the only `sk-ant` in history is the Phase 1 `sk-ant-not-a-real-key`). Reading the PR descriptions found real first names quoted from a real letter in PR 14's body, outside git, where no grep had looked. | Asked the author before editing a published PR description; the scrub now covers PR bodies.
- P8 | The screenshot spec clicked "Balkon" to pick it, but the listing screen preselects the first two highlights, so the click switched Balkon off and the letter screen showed a "Keller is not mentioned" warning. Found by looking at the screenshot, since the spec only waited for elements. | The spec keeps the preselection and the invented letter names both.
- P8 | My README draft said the key is entered in Settings and that export holds "everything except the key"; the code puts the key in the fifth onboarding step and exports only the profile and applications. | Both corrected from the code before committing.
- P8 | ADR audit (a fresh reviewer agent, read-only, every claim checked against the code): no ADR contradicted a product invariant, but 14 sentences had drifted: an incomplete folder map, lint edges credited to the wrong rule, Playwright said to run on PRs only, "two calls per click" ignoring the SDK's own retry, three forward-looking sentences already decided, and ADR 3 pointing at a README privacy section that did not exist yet. The application record and export file had shipped in Phases 2 and 7 with no ADR, against rule 4. | Every sentence fixed from the code; ADR 13 records the two shapes.

## Per-phase narrative

Written at the end, from the log above and the PR descriptions.

**Planning (PR 1).** The working rules came from an earlier project's
CLAUDE.md, separated line by line from its stack. Writing the plan against
the product brief exposed three gaps before any code: the fit check needed a
budget and a WBS flag nobody had listed, "Sent" could not be detected
without touching the submit, and a validator promise ("no invented names")
could not be kept by any simple rule. Each became a written decision rather
than an assumption. ADRs 1 to 7 were proposed with their options and
accepted by the author before Phase 0.

**P0: scaffold (PR 2).** The first probe paid off immediately: the built
manifest had no `action`, so the toolbar icon would not have opened the
panel. The newest TypeScript would have broken the lint gate, so it was
pinned. The boundary rules were proven by breaking each one on purpose, and
CI was seen failing on a throwaway branch before it was trusted. The review
caught a token test that confused "stale" with "changed".

**P1: rules core (PR 3).** Strict TDD on eight modules, 145 tests in about
half a second. Most friction was small and mechanical: Prettier turning an
escape into a literal em dash, a fake key that tripped the key grep, and my
hand-counted word totals being wrong where the code was right. The real
findings were spec conflicts (the "no pets" signal against the "no pet
word" rule; `Nichtraucher` meaning the opposite of `smoker`) and a blank
surname producing `Guten Tag ,`. A mutation pass showed which rules the
tests actually held; one mutation silently failed to apply and was noticed
only because nothing failed.

**P2: storage, onboarding, settings (PR 4).** The Settings smoke test
caught a real bug (UI state passed into storage), which justified the
one-test-per-screen tier. Storage tests passed on the first run, so they
were mutation-checked before being believed. Design conflicts (40px chips
against the 44px tap minimum, a stepper drawn invisibly on its own card
colour) were caught while laying out, before screenshots. This phase also
had the first of two logged Claude co-author trailers against the author's
global rule.

**P3: listing adapter (PR 5).** ImmoScout24 blocks automated browsers, so
the author saved pages from their own session. The probe found the stable
`is24qa-*` and `data-qa` attributes, and a happy-dom bug that silently
parsed 213 elements of a 4 MB page. The scrub was the hardest part: the
saved page carried the author's own name and customer number in a header
the scrub list did not name, and a street pattern missed a two-word
street. Both were found by reading the page text, not by the pattern
check; that lesson shaped every later fixture.

**P4: letter generation (PRs 6 and 7).** The probe established the browser
access header the API requires from an extension, and a second probe was
needed when the SDK turned out to send different headers than the first.
Real letters were the real test: short letters undershot the length floor,
a model rounded `51,44 m²` to `51,4`, and a student with no move-in date
"confirmed" the listing's date. React's StrictMode would have billed every
letter twice had generation started in an effect. A model comparison added
Opus and Fable as settings.

**P4 follow-ups (PRs 8 and 9).** The move-in became a choice (schema 2, ADR 10) and two applicants gained a stated relationship. A fresh reviewer found
four gaps in "claim nothing the profile lacks", including marriage words in
compounds. The author noticed the panel following them into YouTube; it now
belongs to one tab (ADR 8 amendment).

**P5: form filling (PR 10).** The probe showed React ignores a value set
from outside, so fill uses the prototype setter and kept the probe as a
running test. The real form asked seven questions as selects, which the
Phase 1 matcher could not answer, and reading that matcher before using it
showed it would have written `permanent` into a job field. Mutation checks
proved the never-submit tests fail when a submit is added. The reviewer
found seven real gaps, among them `mobil` matching inside `Immobilie`. The
first live check failed because the tab was the site's English address.

**Letter tuning (PRs 11 to 14).** The author's own letters drove four short
rounds. Each fix exposed the next problem: removing stock phrases brought
self-praise, removing that brought invented offers, and the plainer letters
fell under the 120-word floor, where the retry made the model pad with
invented hobbies. The author removed the minimum (ADR 9 amendment). The
lesson: a length floor fights a no-invention rule, and the no-invention
rule matters more.

**P6: unknown sites (PR 15).** The `activeTab` probe found that CDP's
icon click only works on the focused tab and only through a browser-level
session; the e2e run depends on both facts. The reviewer found six real
gaps, the worst being a letter surviving a page load and being written into
the next page's form. One of my tests passed without its fix and had to be
rewritten to fail first.

**P7: tracker (PR 16).** The design system had no drawing of the tracker,
so it was built from the README and the component previews, with the entry
point named as a deviation. Treating imports as untrusted found a
`javascript:` link risk; the reviewer then found that my URL check only
tested the prefix, a stale fill report that could save an unsent letter,
and a read-then-write race. A bug from Phase 4 surfaced too: leaving the
letter screen threw away a paid-for letter.

**P8: docs and release (this PR).** README with screenshots generated by a
skipped-by-default Playwright spec, an ADR audit against the code, this
narrative, and a personal data scrub of the tree, the fixture history and
the PR descriptions.

## Closing reflection

The model was fastest and most reliable where the rules were pure and the
tests came first: the rules core had the fewest surprises per line. It was
weakest at things it could not see. A happy-dom parse that stopped
silently, React state that ignored a set value, a site's English address,
the length of a real letter: each was found by a probe, a real run or the
author's own use, never by reading the code.

Three habits carried the most weight. Probing the risky assumption first
turned guesses into facts before anything was built on them. Mutation
checks caught tests that passed for the wrong reason, several times.
And a fresh reviewer at the end of each phase found real gaps every time,
from P5 on between three and seven, all of them things the implementing
session had reviewed and missed.

Recurring slips are worth naming because they never fully stopped:
hand-counted numbers in tests, a default commit trailer the author's rules
forbid, and restoring a file with `git checkout` during a mutation check
and losing uncommitted work. Each got a fix in the process, not a promise.

Personal data was the hardest invariant. Every leak (a signed-in header, a
two-word street, real names in a PR description) got past the pattern
checks and was found by reading. Reading stays part of the scrub.
