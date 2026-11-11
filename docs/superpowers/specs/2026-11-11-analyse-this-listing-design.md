# Listing analysis on request: "Analyse this listing"

Status: draft for the author's approval. Written from a brainstorm on
2026-11-11. It amends ADR 14 and one product invariant in CLAUDE.md, so
nothing is built until the author approves both.

## Intent

The "About this listing" card (Phase 13, ADR 14) only says what the page
itself shows, and it reads only fields and keywords. When the author pastes
the same listing into a general assistant, they get a much more useful read:
what the rental really is, what the area is like, whether the price is fair,
what the heating means for the bills, and what to ask at the Besichtigung.
They want that read inside Kiezpigeon, on one click, as part of the product.

## Goals

- One button on the Listing detected screen, **"Analyse this listing"**.
  On click, the panel shows a short analysis of the open listing under
  these headings, in this order:
  1. **What this is**: the kind of rental and what the page offers,
     including what the card cannot see today (Staffelmiete, Indexmiete,
     Ablöse, Provision, a furniture fee, a fixed term in the description).
  2. **The area**: the Kiez and its connections.
  3. **Price**: whether Kaltmiete and Warmmiete look fair for the area and
     the flat, with the Mietspiegel and the Mietpreisbremse in mind.
  4. **Heating and energy**: heating type, energy class and Baujahr, and
     what they likely mean for Nebenkosten and winter comfort.
  5. **For you**: fit with the user's budget, household, pets, smoking,
     WBS and move-in date.
  6. **What to watch for**: anything odd, and questions worth asking at
     the Besichtigung.
- Estimates read as estimates ("roughly", "typically for this area").
  What the page does not say is said to be unknown.
- Written in Kiezpigeon's own voice, in English, sentence case, German
  market terms kept German, no em dashes.

## Non-goals

- Running automatically. Nothing is sent when the panel opens. (Author's
  decision: a button, not default-on; default-on would cost roughly
  $40–65 a month at 30 listings a day.)
- Changing or replacing the "About this listing" card, the fit check or
  the letter flow. The card stays free and page-only, next to the new
  analysis.
- Storing the analysis, or caching it per listing. It lives while the
  panel shows that listing and is gone after.
- A provider picker or a second provider. The code calls Anthropic; the
  copy is provider-neutral so a later switch changes no copy.

## Anti-goals (a failure even if it works)

- Changing any existing copy. Settings, onboarding and the letter flow
  keep naming Claude and Anthropic as they do today (author's decision);
  only the new feature's copy is provider-neutral.

- Any copy that names Claude, Anthropic, AI, a model or "assistant". The
  feature reads as Kiezpigeon's own (author's decision).
- An estimate stated as a fact, a score, a traffic light, or the words
  scam or fraud (as in ADR 14).
- Copy that says the analysis checked anything outside the page (it reads
  the page and knows what it knows; it does not look things up).
- Sending the user's names, contact details, current address, job titles
  or letter settings.
- A second teal button. "Write my letter" stays the screen's one teal
  button; the new one is secondary.

## Constraints

- **Explicit action.** The request is sent only on the user's click,
  from the service worker, through `src/claude/`, to the destination ADR 4
  fixes (`https://api.anthropic.com`). No new permission, no new host.
- **Read only what the user is looking at.** The page's visible text is
  read from the active tab when the user clicks, through the content
  script that already serves `getListing`. No background fetches.
- **Key handling** as today: the key never enters a content script, a
  log, an error message or the UI.
- **Rules are pure.** The prompt is built by a pure function in
  `src/rules/` from plain data (page text, the profile subset, the
  `Listing`), strict red-green-refactor like the letter prompt.
- **Model.** `claude-opus-5-5` for this call, whatever the letter model
  setting says (author's decision). About 4–7 cents per click at effort
  `low`.
- **What is sent:** the page's visible text, the adapter's `Listing`
  fields, and from the profile: Warmmiete budget, adults, children, pets,
  smoker, WBS, move-in, employment types and the income-to-rent ratio
  (as the letter prompt already computes it, not raw income).
- **UI rules** as everywhere: tokens only, real `<button>`, 44px targets,
  status never by colour alone, copy never claims something was sent for
  the user.

## Documents this changes (author approves the wording)

- **ADR 14** gets an amendment (Nygard format): the card stays page-only;
  a separate, user-requested analysis may send the page text and the
  profile subset above to the destination in ADR 4, and its output is
  labelled as an estimate. The amendment names its running probe (the
  prompt rule's tests).
- **CLAUDE.md, "Data stays on the device"**: today "The only network
  request the extension makes is the letter generation call (destination
  fixed by ADR 4), on an explicit user action." Proposed: "The extension
  makes two kinds of network request, both to the destination fixed by
  ADR 4 and both on an explicit user action: generating a letter and
  analysing a listing."
- **CLAUDE.md, "Letters obey the letter rules by validation"** is
  unchanged; the analysis is not a letter and has no validator (see
  below).
- **PLAN.md / PHASES.md** get a Phase 14 spec derived from this document.

## Decided

- Button, not automatic; secondary style; on the Listing detected
  screen, next to the "About this listing" card.
- Opus 5.5, fixed for this call.
- The six headings above, in that order.
- The profile subset above; nothing else from the profile.
- Provider-neutral copy; Anthropic-specific code is fine.
- Not stored.

## My calls (the author can overrule)

- **Known sites only** for the first version (ImmoScout24, Vonovia,
  Deutsche Wohnen). The unknown-site fallback can follow; its injected
  reader is a separate path.
- **No validator.** Unlike letters, the analysis is advice the user reads,
  not text sent in their name. The rendering step only guards form:
  replaces em dashes, drops empty sections, caps length.
- **Errors** get their own provider-neutral messages, one per existing
  `ClaudeErrorCode`, worded for this action ("Connect your key in settings
  to analyse listings.", "The analysis is busy right now. Try again in a
  minute.", "Your key cannot run the analysis. Check its access in your
  account."). The letter flow's `ERROR_MESSAGES` stay as they are.
- **A loading state** that says what is happening ("Reading the listing").
  Leaving the screen does not abort the request; a late answer is kept for
  that listing (next point). An abort would need a new messaging pattern
  for a few cents.
- **Lifetime within a panel session.** The analysis is held in the panel's
  memory keyed by listing URL, above `ListingDetected`, so going to the
  letter and back shows it again without paying twice. Closing the panel
  or opening another listing drops it. Still nothing is stored.
- **"The user's data" means the profile, not the listing.** The anti-goal
  on names, contact details and address is about the user. The listing's
  own facts (its address, district, contact person, the landlord's phone)
  are what the analysis is about and are sent; the area section needs the
  street.
- **The user's own data is kept out of the page text.** A signed-in site
  can print the user's name or email in its header (this happened once
  with a fixture, see `docs/ai-workflow.md`). So the text is read from the
  listing's main content (the adapter knows the region), not the whole
  body, and the pure prompt rule removes every value from the profile's
  names, email, phone and street from the text before it is sent, with
  one test per field. Best effort for known values; it is not a general
  PII scrubber.
- **Gating.** The button is always shown on a known listing. Without a key,
  the click shows the same "connect your key" message the letter flow
  shows. An incomplete profile still runs; "For you" says which facts are
  missing instead of guessing.

## Left to the builder

- How the visible text is extracted and how long it may be (a cap that
  keeps a typical page whole; the fixtures hold 3,300 to 6,300 characters).
- The prompt's wording, the response shape (plain text with the six
  headings is enough; parse by heading) and `max_tokens`.
- The component structure and its smoke test, and the manual QA list.
