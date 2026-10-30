# CLAUDE.md: working agreement for Kiezpigeon

You are pair-building Kiezpigeon, a Chrome extension (Manifest V3) for the
Berlin apartment hunt. It reads a listing, writes a tailored German
application letter from the user's profile and fills the listing's contact
form. **The user always reviews and presses Send themselves.** The process
is a deliverable: the repo will be read as evidence of how its author works.
Optimize for legibility over cleverness.

## Ground rules

1. **Follow PLAN.md and PHASES.md.** One phase per session: read CLAUDE.md,
   PLAN.md, and the current phase spec only. Work the phase's "In scope"
   list in order, self-review against its checklists, fix findings, open the
   phase's PR, and stop. Never start the next phase in the same session.
   Never silently expand scope; propose Tier 2/3 items, don't build them.
2. **TDD tiers are non-negotiable.** The rules (fit check, letter
   validation, prompt building, form field matching, tracker stats, profile
   validation, import/export) are strict red-green-refactor: write the
   failing test first, show it fail, make it pass, refactor. Site adapters
   get tests after, against saved listing HTML fixtures. Storage, messaging
   and the Claude client get unit tests after (happy path + one edge, browser
   APIs stubbed). Side panel screens get one smoke test each plus manual QA
   in Chrome. The exact tiers are in PLAN.md section 5.
3. **Small conventional commits.** One logical change per commit,
   `type(scope): subject` (commitlint style). The git history is an artifact.
4. **ADR before load-bearing choice.** Any decision that would be expensive
   to reverse gets a short entry in `docs/decisions.md` (Nygard format:
   Status / Context / Decision / Consequences) in the same commit. A new
   extension permission, a new network destination or a new stored data
   field is always load-bearing. An ADR that describes a runtime mechanism
   gets a running probe in the same commit.
5. **Log AI friction.** When a suggestion is wrong, when tests catch a
   generated bug, when a prompt had to be reworded, when a spec turned out
   to be wrong, append one line to `docs/ai-workflow.md`. Written
   incrementally, never reconstructed.
6. **No real personal data, anywhere.** Not in code, fixtures, tests, docs,
   screenshots, comments, commit messages, PR descriptions or PR comments.
   That includes the author's own circumstances: names, relationship, job
   situation, income, their real letters and listings. Describe real runs
   in general terms ("a real letter named both applicants three times"),
   never by quoting them. Saved listing HTML is scrubbed
   before it is committed: contact person names, phone numbers, email
   addresses, street addresses, listing ids and tracking tokens are replaced
   with invented values, and the fixture's header comment says so. Sample
   profiles are invented. No API key is ever committed, logged or written to
   a fixture.

## Product invariants (hold for every stack)

- **Never submit.** No code path clicks a submit button, calls
  `form.submit()` or `form.requestSubmit()`, dispatches a `submit` event, or
  sends Enter to a field. Filling only sets field values and fires the
  `input`/`change` events a framework-driven form needs. Consent and privacy
  checkboxes are never ticked; file inputs are never touched. A test proves
  the form was not submitted after a fill.
- **Every fill is visible before it happens on an unknown site.** Known
  adapters fill on the user's click; the generic fallback shows the planned
  field mapping and fills only after the user confirms it.
- **Documents are flags only.** The documents checklist stores
  `ready | pending` per document type. No file is ever read, stored or
  uploaded.
- **Data stays on the device.** Profile, letters and tracker live in local
  extension storage. The only network request the extension makes is the
  letter generation call (destination fixed by ADR 4), on an explicit user
  action. No analytics, no telemetry, no remote logging. Settings offer
  export, import and "delete all data".
- **Read only what the user is looking at.** The extension reads the DOM of
  the active tab when the user opens the panel on it. No background fetches
  of listings, no crawling, no polling.
- **Least privilege.** The manifest's permissions and host permissions are
  listed in PLAN.md; adding one needs an ADR.
- **Rules are pure.** Fit check, letter validation, prompt building, field
  matching and stats take plain data and return plain data: no `chrome.*`,
  no DOM, no network, no clock or randomness except passed in.
- **Letters obey the letter rules by validation, not by hope.** German by
  default, at most 180 words, contact person by name when known, strongest
  landlord signals first, 1 or 2 chosen listing features, honest about pets,
  no em dashes, no fact that is not in the profile or the listing. A
  validator checks every generated letter; the prompt alone is not the
  guarantee.
- **Money is integer cents** end to end (`kaltmieteCents`, `netIncomeCents`).
  Formatting to German style (`1.180 €`, `62 m²`, `01.03.2027`) happens only
  in the UI layer.

## UI invariants

- The UI is styled only with the Kiezpigeon design system tokens
  (https://claude.ai/artifact/5M9uVbsEWmLzmcsTc54yoo, `project/tokens.json`).
  No raw hex values, font sizes, spacings or radii in component styles; the
  tokens file in the repo is generated from the system's `tokens.json` and
  is never hand-edited. The design system README and component READMEs are
  the tie-breaker for any visual question.
- One teal primary button per screen, at the bottom. Status is never colour
  alone: every pill carries a word, every check line an icon shape.
- Every control is a real `<button>`, `<input>` with a `<label>`, or
  `<a href>`; minimum target 44px; visible 2px focus ring; toggles use
  `aria-pressed`.
- UI copy: sentence case, "you", buttons are verbs, no em dashes, German
  market terms stay German (Kaltmiete, Warmmiete, SCHUFA, WBS, Besichtigung).
  Copy never claims something was sent for the user.

## Tech invariants

From ADRs 1 to 7 in `docs/decisions.md`.

- WXT (Vite-based) builds the extension, `srcDir: "src"`, entrypoints under
  `src/entrypoints/`; the manifest is generated from `wxt.config.ts`. npm,
  Node 24 LTS (`.nvmrc`), lockfile committed. TypeScript strict everywhere
  (`"strict": true`, `"noUncheckedIndexedAccess": true`). No `any`, no
  non-null assertions without a comment.
- One package, folder boundaries enforced by ESLint `no-restricted-imports`:
  `src/rules/` imports only from itself; `src/adapters/` and `src/fill/` may
  import `src/rules/` but nothing from `src/ui/`, `src/storage/` or
  `src/claude/`. The folder map is in ADR 6.
- The side panel is React 19 function components. No component library:
  design system components are rebuilt in `src/ui/components/`.
- `src/storage/` is the only code that touches `chrome.storage`. All data is
  in `chrome.storage.local` (`schemaVersion`, `profile`, `settings`,
  `applications`, `apiKey`), validated on read by the rules core's
  hand-written validators. No `chrome.storage.sync`, no IndexedDB, no schema
  library, no global state library.
- `src/claude/` is the only code that talks to `https://api.anthropic.com`,
  and only from the service worker. The user's own key never enters a
  content script, a log, an error message or an export. Default model
  `claude-sonnet-5-5`; `claude-opus-5-5` and `claude-fable-5-1` as stronger
  settings, `claude-haiku-5-5` as the cheaper one (ADR 4 amendment).
- Tests: Vitest with WXT's Vitest plugin and fake browser, happy-dom,
  `@testing-library/react`; Playwright in `e2e/` for the never-submit run.
  `npm test` typechecks before it runs Vitest.
- Styling: CSS Modules referencing only `var(--…)` from the generated
  `src/styles/tokens.css` and its type classes; stylelint enforces it. Never
  edit `tokens.css` by hand: change `design/tokens.json` and run
  `npm run tokens`. Plus Jakarta Sans is bundled; no remote fonts.
- Fixtures live in `fixtures/<site>/`; invented sample profiles in
  `test-support/sample-profiles.ts`, used by every test and screenshot.

## Definition of done for any task

Tests pass, typecheck passes, lint passes, the production build succeeds,
the relevant PLAN.md checkbox can honestly be ticked, and, if the change is
user-visible or touches a content script, the built extension is loaded
unpacked in Chrome and the change is verified there (on a saved fixture page,
and on a live listing when an adapter changed) with no errors in the service
worker, side panel or content script consoles.
