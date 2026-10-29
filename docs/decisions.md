# Architecture decision records

Short-form Nygard entries: Status, Context, Decision, Consequences.
Numbered in the order PLAN.md lists them; an entry is written in the same
commit as the choice it records.

ADRs 1 to 7 were proposed with their options and trade-offs, then accepted
by the author before Phase 0; the proposals are in the git history. Each
entry keeps one line per rejected option so the cut stays visible.

| ADR | Title                                                          | Phase | Status   |
| --: | -------------------------------------------------------------- | ----- | -------- |
|   1 | WXT for the extension build, TypeScript strict                 | P0    | accepted |
|   2 | React 19 for the side panel, no component library              | P0    | accepted |
|   3 | All data in `chrome.storage.local` behind one module           | P2    | accepted |
|   4 | The user's own Claude API key, behind a client interface       | P4    | accepted |
|   5 | Vitest + happy-dom + Testing Library, Playwright for e2e       | P0    | accepted |
|   6 | Single package with lint-enforced folder boundaries            | P0    | accepted |
|   7 | Generated token variables, CSS Modules, stylelint gate         | P0    | accepted |
|   8 | One adapter per site: DOM in, `Listing` and form out           | P3    | accepted |
|   9 | The validator is the guarantee: generate, validate, retry once | P4    | accepted |
|  10 | Move-in as a choice, schema 2                                  | P4+   | accepted |

## ADR 1: WXT for the extension build, TypeScript strict

**Status.** Accepted.

**Context.** Kiezpigeon is a Manifest V3 extension with three runtime
contexts: a service worker, a side panel page and a content script on
ImmoScout24, plus scripts injected on demand for the fallback. The build has
to produce a valid manifest, bundle each context separately, reload quickly
during development and stay understandable to a reviewer. The rules core and
the message contracts between contexts benefit most from types.

**Decision.** WXT (Vite-based) with `srcDir: "src"`: entrypoints are files
under `src/entrypoints/`, the manifest is generated from them plus
`wxt.config.ts`. WXT is used plainly: entrypoints, the generated manifest,
dev reload and its test helpers. Storage and messaging go through our own
thin modules (ADRs 3 and 6), not WXT's optional helpers, so the code reads
the same on any build tool. TypeScript everywhere with `"strict": true` and
`"noUncheckedIndexedAccess": true`, extending WXT's generated tsconfig.
Node 24 LTS, pinned in `.nvmrc` and `engines`.

Rejected: Vite + `@crxjs/vite-plugin` (readable hand-written manifest, but a
plugin with a history of thin maintenance); Plasmo (opinionated APIs leak
into the code, slowed development); hand-rolled esbuild/Vite (rebuilds what
WXT does); plain JavaScript (loses the types the message contracts need).

**Consequences.** Fast dev loop and correct MV3 output from day one; Firefox
stays a cheap Tier 3 option. The manifest is reviewed as `wxt.config.ts`
plus the built `.output/chrome-mv3/manifest.json` (Phase 0's review checks
the built one). A WXT major upgrade is a deliberate task with its own
friction log line.

## ADR 2: React 19 for the side panel, no component library

**Status.** Accepted.

**Context.** The side panel has four screens (onboarding in steps, listing
detected, letter ready, tracker) plus profile and settings: forms with live
validation, a multi-step flow, toggles and steppers, and state that must
follow storage changes made elsewhere. Bundle size matters little (the panel
loads from disk); legibility, testing support and accessible form controls
matter most. Content scripts render no UI.

**Decision.** React 19 function components. No component library: the
design system's components (Button, Card, Chip, PanelHeader,
SegmentedControl, StatusPill, Stepper, TextField) are rebuilt as small local
components in `src/ui/components/`, screens live in `src/ui/screens/`. The
React hooks and compiler lint rules are part of the lint gate from Phase 0.

Rejected: Preact with signals (compat layer, differences trip reviewers);
Svelte 5 (least form code, but a less familiar model and generated code
that mixes in Svelte 4 syntax).

**Consequences.** Screens are plain components; the rules core stays
framework-free, so a later UI switch touches only `src/ui/` and the panel
entrypoint. Effects and stale closures are the expected source of generated
bugs; the hooks lint rules are the first line against them.

## ADR 3: All data in `chrome.storage.local` behind one module

**Status.** Accepted.

**Context.** Persistent data is small: one profile (a few kB), settings, the
API key (ADR 4), and applications (roughly 2 to 4 kB each; hundreds over a
hunt). The panel, service worker and content scripts all need the profile;
the panel must update when data changes elsewhere. Data must never leave the
device, must be exportable, importable and deletable in one action, and must
survive schema changes.

**Decision.** Everything in `chrome.storage.local` under the keys
`schemaVersion`, `profile`, `settings`, `applications`, `apiKey`.
`src/storage/` is the only code that touches `chrome.storage`; it validates
on read with the rules core's hand-written validators (no schema library),
runs migrations keyed by `schemaVersion`, and exposes a `useStored(key)`
React hook driven by `chrome.storage.onChanged`. UI state is component
state; no global state library until a screen proves it needs one. "Delete
all data" is one `chrome.storage.local.clear()`.

Rejected: IndexedDB for applications (real queries, but two stores to
export, migrate and wipe, and no access from content scripts);
`chrome.storage.sync` for the profile (sends personal data through the
user's Google account, 8 kB item quota); zod or valibot for validation (a
second place import rules would live, outside strict TDD).

**Consequences.** One module to read, test and clear. Nothing is encrypted
at rest: anyone with access to the Chrome profile can read the data,
including the API key, which the README's privacy section says plainly. If
the tracker ever needs search or thousands of rows, IndexedDB behind the
same module is the migration path. `unlimitedStorage` is not requested; the
default 10 MB quota is far above need.

## ADR 4: The user's own Claude API key, behind a client interface

**Status.** Accepted.

**Context.** Letter generation is the only network call. The request
contains personal data (names, income, household). Whatever carries it must
keep the key secret, keep the data off third-party servers where possible,
and fail clearly. The project has no budget for paying other people's
generation costs and no wish to run a server that sees applicants' income.

**Decision.** `src/claude/` defines `generate({ system, user }, options):
Promise<string>` and one implementation that calls the Messages API at
`https://api.anthropic.com` directly with the user's own key. The key is
entered in settings, stored under `apiKey` in `chrome.storage.local`, never
exported, never logged, never placed in an error message. Requests run only
in the service worker; the panel asks for a letter by message, and the key
never enters a content script or a page's context. The model is a setting:
default `claude-sonnet-5-5`, with `claude-haiku-5-5` offered as the cheaper
option; both go through the same validator. A backend implementation of the
same interface is a Tier 3 option. Phase 4 starts with a probe that a
service worker request succeeds with the key and that the key appears in no
log, message to a content script, or export.

Rejected for Tier 1: a backend proxy holding the author's key (someone pays
per letter, needs abuse protection, and personal data would pass through a
server the author operates).

**Consequences.** Host permission for `https://api.anthropic.com/*`.
Onboarding gains a "connect Claude" step with a link to where keys are
created and one plain sentence about cost. Non-developer users face real
setup friction; acceptable for v1. A Web Store release (Tier 3) needs either
clear own-key wording or the backend.

**Implementation (Phase 4).** `src/claude/claude.ts` uses the official
`@anthropic-ai/sdk` (1.x) rather than hand-written `fetch`: typed errors
map to user-facing codes without matching message strings, and the SDK
tracks API versions. It is created with the base URL fixed to
`https://api.anthropic.com`, `dangerouslyAllowBrowser` (which sends the
`anthropic-dangerous-direct-browser-access` header the API requires from
an extension; without it the API answers 401 with a CORS message), one
retry, a 60 s timeout and logging off. SDK 1.x sends the key as
`Authorization: Bearer` at API version `2026-10-21`; the probe saw the API
accept that from a service worker for both models. Every failure becomes a
`ClaudeError` whose message is written in this module, never the API's,
so the key cannot travel in an error. The server-side refusal fallback is
not enabled: a refusal on a rental letter is unlikely, and a fallback
would silently bill the user's key for a different model; a refusal shows
as an error instead. The running probe is `src/claude/claude.test.ts`.

**Amendment (2026-10-29, after Phase 4).** Two stronger models join the
setting: `claude-opus-5-5` and `claude-fable-5-1`. Sonnet stays the
default; Haiku stays the cheap option. The author asked for both after a
comparison of the same six acceptance letters (one run each, effort low):
Opus passed every check on the first call at about 2.7 cents and 12 s a
letter; Fable passed all six after retries at 3 to 14 cents and up to 25 s,
with no visible gain over Opus at this length; Sonnet passed all six at
0.5 to 1.1 cents and 4 to 6 s; Haiku passed four. The request is the same
for every model (Fable runs adaptive thinking on its own, which the client
never configures), and every letter still goes through the validator.
Fable needs 30-day data retention on the user's Anthropic organisation;
settings says so when it is picked, because a refusal there arrives as a
generic failure. The picker becomes a labelled select: four options with
their trade-offs do not fit a segmented control at 320px.

## ADR 5: Vitest + happy-dom + Testing Library, Playwright for e2e

**Status.** Accepted.

**Context.** PLAN.md section 5 sets the tiers: strict TDD for the rules
core, fixture-driven tests for adapters against saved HTML, pragmatic tests
for storage, messaging and the Claude client with browser APIs stubbed, one
smoke test per screen, and one end-to-end run that proves a fill never
submits.

**Decision.** Vitest for every unit, fixture and smoke test, configured
with WXT's Vitest plugin so `chrome.*` resolves to WXT's in-memory fake
browser. happy-dom is the default environment; adapter tests switch to
jsdom per file only if Phase 3's probe shows a fixture parses differently,
and that is logged. Screens render with `@testing-library/react`.
Playwright runs the end-to-end tests in `e2e/`: Chromium launched with the
built extension loaded, a local fixture page served, the panel page opened
by its `chrome-extension://` URL, a fill performed, and the fixture form's
submit record asserted empty. `npm test` runs `tsc --noEmit` before Vitest,
so type errors fail the test script.

Rejected: Vitest only with no e2e (the never-submit guarantee would be
tested only in pieces); Jest + jsdom + Puppeteer (ESM and TypeScript
transforms, fights the Vite build).

**Consequences.** Two runners. CI runs unit and fixture tests on every push
and the Playwright run on every PR (headless Chromium with the extension
loaded; if that proves flaky in CI, the fallback is `xvfb-run` headed, and
the choice is logged). Fixtures are committed, scrubbed and versioned. The
model writes both code and tests, so adapters are also checked against a
live page by hand whenever they change.

## ADR 6: Single package with lint-enforced folder boundaries

**Status.** Accepted.

**Context.** The deliverable is one extension. The rules core must stay
free of browser and framework imports. There is no backend in Tier 1
(ADR 4).

**Decision.** One npm package (npm, lockfile committed):

```
src/
  entrypoints/   background.ts, sidepanel/ (index.html, main.tsx),
                 immoscout24.content.ts
  rules/         pure: types, money, format, profile, fit, letterPrompt,
                 letterValidate, fieldMatch, tracker
  adapters/      DOM in, plain data out: adapter interface, immoscout24/,
                 generic/
  storage/       the only chrome.storage access
  messaging/     typed messages between panel, worker and content scripts
  claude/        the generate() interface and its direct-key implementation
  fill/          writes values into a page's form; never submits
  ui/            components/, screens/, hooks/
  styles/        tokens.css (generated), fonts.css, global.css
design/          tokens.json copied from the design system
public/          icon/ (16, 32, 48, 128), fonts/ (Plus Jakarta Sans + OFL)
fixtures/        immoscout24/, generic/ (scrubbed HTML)
test-support/    sample-profiles.ts (invented people only)
scripts/         build-tokens.ts
e2e/             Playwright tests
```

ESLint `no-restricted-imports` overrides enforce the edges: `src/rules/`
imports only from itself; `src/adapters/` and `src/fill/` may import
`src/rules/` but not `src/ui/`, `src/storage/` or `src/claude/`; only
`src/storage/` references `chrome.storage`; only `src/claude/` references
the API host.

Rejected: a workspaces monorepo (package edges buy nothing for one
deliverable and cost wiring time); pnpm (an extra install for no gain at
this size).

**Consequences.** The boundary rules land in Phase 0, before there is code
to violate them. The folders map one-to-one onto packages, so if a backend
arrives the split is mechanical, and is its own phase and ADR.

## ADR 7: Generated token variables, CSS Modules, stylelint gate

**Status.** Accepted.

**Context.** The UI must be styled only with the Kiezpigeon design system's
tokens (colours, type styles, spacing, radii, sizes). The design system
README asks for CSS custom properties (`var(--teal)`, `var(--space-4)`) and
never pasted hex values. Breaking the rule must fail a check, and the tokens
in the repo must not drift from the system's.

**Decision.** `design/tokens.json` is a verbatim copy of the system's
`project/tokens.json`. `scripts/build-tokens.ts` (`npm run tokens`)
generates `src/styles/tokens.css`: one custom property per colour, spacing,
radius and size token (`--night-800`, `--space-4`, `--radius-xl`,
`--tap-min`) and one utility class per type style (`.type-title-xl`,
`.type-body`), with the header `/* generated from design/tokens.json, do
not edit */`. A Vitest test regenerates in memory and fails if the
committed file differs. Components style with CSS Modules that reference
only `var(--…)` and the type classes. Stylelint, with
`stylelint-declaration-strict-value`, requires `var()` for colour,
background, border colour, font size, line height, padding, margin, gap
and border radius, and forbids hex and named colours, everywhere except
the generated file. Plus Jakarta Sans 400, 600, 700, 800 is bundled as
woff2 in `public/fonts/` with its OFL licence; no remote font loading.

Rejected: Tailwind v4 with a token-only theme (long class strings, and
arbitrary values need their own ban); vanilla-extract typed tokens (a build
plugin and a less common styling model for a guarantee stylelint already
gives).

**Consequences.** Every component has a small CSS module; a grep for `#` in
`src/**/*.module.css` should return nothing. Updating the design system
means re-copying `tokens.json` and running `npm run tokens`, in one commit.
Values the design system gives only in component READMEs (the 168px planet,
18px card padding) become component-scoped custom properties declared in
the module with a comment naming the README, so the stylelint rule still
holds.

## ADR 8: One adapter per site: DOM in, `Listing` and form out

**Status.** Accepted.

**Context.** Every listing site lays out the same facts differently, and
ImmoScout24 can change its markup at any time (PLAN.md risks). The fit
check, the letter and the form mapping must not care which site a listing
came from. A missing field on a page is normal, not an error. The panel
needs the listing of the tab the user is looking at, and nothing else
(CLAUDE.md "Read only what the user is looking at").

**Decision.** `src/adapters/types.ts` defines `SiteAdapter`: `id`,
`siteName`, `matches(url)`, `readListing(document, url): Listing |
undefined` and `readContactForm(document): FormField[]`. `readListing`
returns `undefined` only when the page is not a listing, and otherwise never
throws: a field it cannot read is left out of the `Listing` and named in
`missing`. It reads stable attributes first (ImmoScout24's `is24qa-*`
classes and `data-qa` attributes, found by the Phase 3 probe) and parses
the visible text inside them; it does not read the page's tracking
variables or inline scripts. Adapters take a `Document` and the URL as
arguments, so tests run them on saved fixtures without a browser.
`readContactForm` returns the rules core's `FormField`, so `fieldMatch`
needs no adapter types.

A content script per known site runs on the site's listing pages (the
manifest's `content_scripts` match, which grants no extra permission) and
answers typed messages from `src/messaging/` by calling its adapter. The
side panel finds the active tab with `tabs.query` (the tab id needs no
`tabs` permission), asks its content script for the listing when the panel
opens, and asks again on `tabs.onActivated` and on `tabs.onUpdated` with
status `complete`. No answer means "not a listing": the panel never injects
a script or fetches a page to find out.

Rejected: reading `utag_data` or the `ld+json` block (complete and
machine-shaped, but tracking and SEO data with no promise of stability, and
the content script would have to parse script text); one generic reader for
every site (that is the Phase 6 fallback for forms, not a way to read
prices reliably); the `tabs` permission to read each tab's URL (a broad
permission for something an unanswered message already tells us).

**Consequences.** Adding a site is a new folder in `src/adapters/`, a
content script entrypoint, its host match in the manifest and its
fixtures, with no change to the rules core or the UI. The phase spec's
`readListing(document)` gains a `url` argument and an `undefined` result
for "not a listing"; its `FormFieldDescriptor` is the existing `FormField`.
A tab opened before the extension was installed or updated has no content
script until it is reloaded; the not-a-listing screen says so.

## ADR 9: The validator is the guarantee: generate, validate, retry once

**Status.** Accepted.

**Context.** The letter rules (length, no em dashes, no number outside the
facts, the right salutation, honest pets, the chosen highlights) are
product invariants. A prompt makes a model likely to keep them, never
certain. Each extra call costs the user money and seconds, and a letter
the user never sees because it failed a check helps nobody.

**Decision.** `writeLetter(request, generate)` in `src/rules/writeLetter.ts`
builds the prompt, calls the injected `generate`, and runs
`validateLetter` on the trimmed answer. A letter with no problems is
returned after one call. Otherwise the same rules go back once, with the
facts, the previous letter and one plain sentence per problem
(`describeProblem`). The second letter is returned whatever it holds, with
its problems, and the "Letter ready" screen shows them as warnings beside
the letter; the user edits or rewrites. The same sentences are used for
the model and for the user. The generator is a parameter, so the loop is
pure and tested with scripted answers.

Rejected: retrying until valid (unbounded cost and wait for the user's own
key); hiding an invalid letter (the user loses a draft that may need one
word changed); a third call that keeps the better of two letters (more
cost for a choice the user makes faster by reading).

**Consequences.** At most two calls per click. A letter can reach the
screen with problems, so the screen must show them plainly and the user
must still review it, which they do anyway. Rules the validator does not
check (invented prose details) stay the user's job, as PLAN.md risks
says. The running probe is `src/rules/writeLetter.test.ts`.

## ADR 10: Move-in as a choice, schema 2

**Status.** Accepted.

**Context.** The profile stored the move-in as one optional date. Two real
answers did not fit: "as soon as possible" and "the date does not matter".
Both are strong landlord signals, since every empty month costs rent, and
the letter could not use them. The contact forms Phase 5 fills also ask for
an Einzugstermin.

**Decision.** `Profile.moveIn` is a choice: `{ kind: "date", date }`,
`{ kind: "asap" }` or `{ kind: "flexible" }`; absent means not stated. It
replaces `moveInDate`. Stored data moves to schema 2: `MIGRATIONS[1]` turns
a stored `moveInDate` into a date move-in through the rules core's
`upgradeProfileV1`, and leaves a store without a profile alone. Export files
are version 2; a version 1 file still imports through the same function.
`moveInDateOf` gives code that needs a date (the fill layer, the number
check) the date of a date move-in only.

Rejected: a `moveInFlexible` flag beside the date (it allows "a date and as
soon as possible" at once); free text (the letter and the fill layer could
not use it).

**Consequences.** An older Kiezpigeon build refuses schema 2 data instead
of misreading it (the existing newer-version guard). Phase 5 fills an
Einzugstermin field only for a date move-in, and must decide how to word
"as soon as possible" in a free-text field. The running probes are the
migration tests in `src/storage/storage.test.ts` and the import test in
`src/rules/profile.test.ts`.
