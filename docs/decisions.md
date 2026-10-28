# Architecture decision records

Short-form Nygard entries: Status, Context, Decision, Consequences.
Numbered in the order PLAN.md lists them; an entry is written in the same
commit as the choice it records.

ADRs 1 to 7 are **proposed**. Each lists the options considered with their
trade-offs and a recommendation. When the author picks, the entry's
"Options" section shrinks to one line per rejected option, "Recommendation"
becomes "Decision", the status becomes accepted, and CLAUDE.md's "Tech
invariants" and the **[stack]** lines in PHASES.md are filled in, all in one
commit, before Phase 0.

| ADR | Title                                                  | Phase | Status   |
| --: | ------------------------------------------------------ | ----- | -------- |
|   1 | Extension framework and build setup                    | P0    | proposed |
|   2 | UI framework for the side panel                        | P0    | proposed |
|   3 | State and storage                                      | P2    | proposed |
|   4 | How the extension talks to the Claude API              | P4    | proposed |
|   5 | Testing approach and tooling                           | P0    | proposed |
|   6 | Repo structure                                         | P0    | proposed |
|   7 | Styling with design tokens only                        | P0    | proposed |

## ADR 1: Extension framework and build setup

**Status.** Proposed.

**Context.** Kiezpigeon is a Manifest V3 extension with three runtime
contexts: a service worker, a side panel page and a content script on
ImmoScout24, plus scripts injected on demand for the fallback. The build has
to produce a valid manifest, bundle each context separately, reload quickly
during development and stay understandable to a reviewer. All options
below assume TypeScript with strict settings (`strict`,
`noUncheckedIndexedAccess`); plain JavaScript was not considered because the
rules core and the message contracts between contexts benefit most from
types. **Confirm this assumption.**

**Options.**

- **A. WXT** (Vite-based extension framework). Entrypoints are files in a
  folder; the manifest is generated from them plus a config; dev mode
  reloads the extension; framework-agnostic (React, Preact, Svelte, Vue,
  vanilla); ships typed storage and messaging helpers (optional) and a fake
  browser for unit tests; Firefox output for free. Trade-off: a framework
  with its own conventions and a generated manifest, so the reviewer reads
  config instead of `manifest.json`; one more dependency whose majors we
  follow.
- **B. Vite + `@crxjs/vite-plugin`.** A plain Vite project with a
  hand-written `manifest.json` that the plugin reads to find entrypoints;
  HMR in the side panel and content scripts. Trade-off: closest to "just
  Vite", manifest stays a readable file; the plugin had a long beta and
  periods of thin maintenance, so its health needs checking at decision
  time.
- **C. Plasmo.** Batteries-included, React-first, Parcel-based. Trade-off:
  fastest start, but opinionated in ways that leak into the code (its own
  messaging and storage APIs, file naming), and its development pace has
  slowed visibly; least portable if we leave it.
- (Considered and dropped: hand-rolled esbuild or Vite with several entry
  configs. Maximum transparency, but rebuilds what A and B already do and
  costs Phase 0 a day of glue.)

**Recommendation.** A, WXT, used plainly: entrypoints and the generated
manifest, its dev reload and its test helpers; our own thin wrappers for
storage and messaging (ADR 3) rather than its optional helpers, so the code
reads the same on any build tool.

**Consequences.** Fast dev loop and correct MV3 output from day one; Firefox
stays a cheap Tier 3 option. The manifest is reviewed as WXT config plus the
built `manifest.json` (Phase 0's review checks the built one). A WXT major
upgrade is a deliberate task with its own friction log line.

## ADR 2: UI framework for the side panel

**Status.** Proposed.

**Context.** The side panel has four screens (onboarding in steps, listing
detected, letter ready, tracker) plus profile and settings. It has forms
with live validation, a multi-step flow, toggles and steppers, and state
that must follow storage changes made elsewhere. Bundle size matters little
(the panel loads from disk); legibility, testing support and accessibility
of form controls matter most. Content scripts render no UI.

**Options.**

- **A. React 19.** The largest ecosystem and the most familiar code to a
  reviewer; Testing Library is mature; controlled inputs make the live
  validator and edit-in-place letter straightforward. Trade-off: more
  boilerplate for forms; effects and stale closures are the classic source
  of generated bugs.
- **B. Preact (with signals).** React's API at a fraction of the size,
  signals make storage-driven state simple. Trade-off: a compat layer for
  some React libraries, smaller community, a reviewer may trip on the
  differences.
- **C. Svelte 5.** Least code for forms and bindings, runes make reactive
  state explicit, good accessibility warnings at compile time. Trade-off:
  a different mental model from most reviewers' daily work; smaller testing
  ecosystem; generated Svelte 5 code often mixes in Svelte 4 syntax, which
  will cost friction-log entries.

**Recommendation.** A, React 19, with no component library: the design
system's components (Button, Card, Chip, PanelHeader, SegmentedControl,
StatusPill, Stepper, TextField) are rebuilt as small local components. If
you prefer less boilerplate over familiarity, C is the strongest
alternative.

**Consequences.** Screens are plain function components; the rules core
stays framework-free, so switching UI framework later touches only the
panel. React's lint rules (hooks, compiler) are part of the lint gate from
Phase 0.

## ADR 3: State and storage

**Status.** Proposed.

**Context.** Persistent data is small: one profile (a few kB), settings,
possibly an API key (ADR 4), and applications (each a listing summary plus a
letter, roughly 2 to 4 kB; hundreds over a hunt). The panel, service worker
and content scripts all need the profile; the panel must update when data
changes elsewhere. Data must never leave the device (CLAUDE.md), must be
exportable, importable and deletable in one action, and must survive schema
changes.

**Options.**

- **A. Everything in `chrome.storage.local`** behind one typed module: keys
  `profile`, `settings`, `applications`, `schemaVersion`; runtime validation
  on read and on import; `chrome.storage.onChanged` drives panel updates.
  Trade-off: simplest, one place to export and clear, readable in DevTools;
  whole-key writes (fine at this size); 10 MB default quota, far above need.
- **B. `chrome.storage.local` for profile and settings, IndexedDB (via a
  small wrapper such as Dexie or idb) for applications.** Trade-off: real
  queries and indexes for the tracker, scales to thousands of rows; two
  stores to export, migrate and wipe, and IndexedDB is not reachable from
  content scripts on the extension's origin, so access is via messages.
- **C. `chrome.storage.sync` for the profile.** Follows the user across
  devices. Rejected as a default: it sends personal data through the user's
  Google account, which breaks "data stays on the device", and its quotas
  (8 kB per item) are tight. Listed so the cut is deliberate.

In-memory UI state, for any option: component state plus one storage hook;
no global state library until a screen proves it needs one. Runtime
validation of stored and imported data: a schema library (zod or valibot)
in the storage module, or hand-written validators in the rules core
(Phase 1 already specifies import validation). **Pick one.**

**Recommendation.** A, with validation in the rules core (hand-written,
strict TDD, so import rules are tested where the other rules are) and no
schema library unless Phase 2 shows it is needed.

**Consequences.** One storage module is the only code touching
`chrome.storage`; "delete all" is one `clear()`. Nothing is encrypted at
rest: anyone with access to the Chrome profile can read the data, which the
README's privacy section says plainly. If the tracker ever needs search or
thousands of rows, B is the migration path behind the same module.

## ADR 4: How the extension talks to the Claude API

**Status.** Proposed.

**Context.** Letter generation is the only network call. The request
contains personal data (names, income, household). Whatever carries it must
keep the key secret, keep the data off third-party servers where possible,
and fail clearly. The project has no budget for paying other people's
generation costs and no wish to run a server that sees applicants' income.

**Options.**

- **A. The user's own API key.** Entered in settings, stored in
  `chrome.storage.local`, never exported or logged; requests go from the
  service worker (never a content script, so the key never enters a page's
  context) straight to `api.anthropic.com` with the header that permits
  direct browser access. Trade-off: no server, no cost to the author, data
  goes only to Anthropic; but every user needs an Anthropic Console account
  and a key, which is friction for non-developers, and a stolen Chrome
  profile leaks the key.
- **B. A small backend proxy** (one serverless function holding the key).
  Trade-off: zero setup for users, the key never ships; but someone pays per
  letter, the endpoint needs abuse protection (per-install tokens, rate
  limits), personal data passes through a server the author operates (which
  then needs a privacy policy and data handling rules), and the repo gains
  a deploy target.
- **C. A now, B later.** One client interface (`generate({ system, user })`)
  with the direct-key implementation in Tier 1 and a backend implementation
  as a Tier 3 option, chosen by a setting.

Model: a setting with a default. **Recommendation for the default:**
`claude-sonnet-5-5` for letter quality, with `claude-haiku-5-5` offered as
the cheaper option; both behind the same validator.

**Recommendation.** C: ship A in Tier 1 behind an interface that a backend
can implement later. Phase 4 starts with a probe that a service worker
request with the key succeeds and that the key never appears in a content
script or a log.

**Consequences.** Host permission for `https://api.anthropic.com/*` in the
manifest. Onboarding gains a "connect Claude" step (or settings field) with
a link to where keys are created and a plain sentence about cost. A Web
Store release (Tier 3) needs either clear BYOK wording or the backend.

## ADR 5: Testing approach and tooling

**Status.** Proposed.

**Context.** PLAN.md section 5 sets the tiers: strict TDD for the rules
core, fixture-driven tests for adapters against saved HTML, pragmatic tests
for storage, messaging and the Claude client with browser APIs stubbed, one
smoke test per screen, and one end-to-end run that proves a fill never
submits. The tooling must make each tier cheap.

**Options.**

- **A. Vitest + a DOM implementation (happy-dom or jsdom) + Testing
  Library + Playwright for one or two end-to-end runs.** Vitest for every
  unit and fixture test (fast, native ESM and TypeScript, works with the
  WXT/Vite build); adapters parse fixture files into a DOM document; screens
  render with Testing Library; `chrome.*` comes from a fake browser
  (WXT's, or a small hand-written stub). Playwright launches Chromium with
  the built extension loaded, opens a local fixture listing and the panel
  page by its `chrome-extension://` URL, fills, and asserts the fixture
  form recorded no submit. Trade-off: two test runners; Playwright with
  extensions needs a headed or new-headless Chromium in CI.
- **B. Vitest + DOM only, no end-to-end.** Trade-off: one runner, fastest
  CI; the never-submit guarantee and the panel-to-content-script wiring are
  tested only in pieces and by manual QA.
- **C. Jest + jsdom + Puppeteer.** Trade-off: well known, but ESM and
  TypeScript need transforms, slower, and it fights a Vite build; no
  advantage here.

**Recommendation.** A. happy-dom by default for speed; jsdom for adapter
tests if a fixture parses differently (decided by Phase 3's probe and
logged). Playwright limited to the end-to-end runs PLAN.md names, not
screen-by-screen.

**Consequences.** CI runs unit and fixture tests on every push and the
Playwright run on every PR. Fixtures are committed, scrubbed and versioned;
a site change shows up as a failing fixture test after a new fixture is
saved. The model writes both code and tests, so type checking runs inside
the test script from Phase 0, and adapters are also checked against a live
page by hand when they change.

## ADR 6: Repo structure

**Status.** Proposed.

**Context.** The deliverable is one extension. The rules core must stay
free of browser and framework imports. A backend exists only if ADR 4
picks B (or in Tier 3).

**Options.**

- **A. Single package with enforced folder boundaries.** `src/rules/`
  (pure), `src/adapters/` (DOM in, plain data out), `src/storage/`,
  `src/messaging/`, `src/claude/`, entrypoints for the service worker,
  panel and content script, `fixtures/`, `e2e/`. A lint rule forbids
  imports from `rules/` to anything outside it and from adapters to the UI.
  Trade-off: one install, one build, one config set; boundaries are
  enforced by lint rather than by package edges.
- **B. Workspaces monorepo:** `apps/extension`, `packages/rules`,
  `packages/adapters`, later `apps/backend`. Trade-off: package edges make
  the boundaries physical and a backend slots in; but workspace wiring,
  TypeScript project references and per-package configs cost time that buys
  nothing for a single deliverable.
- **C. A now, B when a second deployable appears.** The folder boundaries
  in A map one-to-one onto B's packages, so the move is mechanical.

Package manager: npm (nothing extra to install) or pnpm (stricter
dependency resolution, faster). **Pick one;** recommendation npm unless you
prefer pnpm.

**Recommendation.** C: start as A.

**Consequences.** The boundary lint rule is part of Phase 0, before there
is code to violate it. If the backend arrives, the split is its own phase
and its own ADR.

## ADR 7: Styling with design tokens only

**Status.** Proposed.

**Context.** The UI must be styled only with the Kiezpigeon design system's
tokens (colours, type styles, spacing, radii, sizes from `tokens.json`).
The design system README asks for CSS custom properties (`var(--teal)`,
`var(--space-4)`) and never pasted hex values. The rule needs a mechanism
that makes breaking it fail a check, and the tokens in the repo must not
drift from the system's.

**Options.**

- **A. Generated CSS custom properties + scoped plain CSS (CSS Modules).**
  A script turns `tokens.json` into `tokens.css` (one variable per token,
  one class or variable group per type style); components use CSS Modules
  that reference only `var(--…)`; stylelint forbids hex, named colours and
  raw lengths outside the generated file. Trade-off: closest to the design
  system's own wording, no runtime, readable; one more lint tool.
- **B. Tailwind v4 with the theme generated from `tokens.json`.** The
  default palette, spacing and radius scales are reset so only token
  utilities exist (`bg-night-700`, `p-4` meaning `space-4`, `rounded-xl`).
  Trade-off: fast to write, no CSS files; long class strings in markup, and
  arbitrary values (`bg-[#123456]`) need a lint rule to ban.
- **C. Typed tokens in TypeScript (for example vanilla-extract).** A tokens
  contract checked by the compiler; using a non-token is a type error.
  Trade-off: strongest guarantee; adds a build plugin and a less common
  styling model.

**Recommendation.** A. It matches the design system's instructions word for
word, keeps the generated `tokens.css` as the single source in the repo,
and the staleness test (Phase 0) catches drift from `tokens.json`.

**Consequences.** Every component has a small CSS module; reviewers can
grep for `#` in style files and expect nothing. Plus Jakarta Sans is
bundled as woff2 (the README warns that MV3 pages should not rely on remote
fonts). Updating the design system means re-copying `tokens.json` and
regenerating, in one commit.
