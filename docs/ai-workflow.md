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

## Per-phase narrative

Written at the end, from the log above and the PR descriptions.
