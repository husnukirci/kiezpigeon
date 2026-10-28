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

## Per-phase narrative

Written at the end, from the log above and the PR descriptions.
