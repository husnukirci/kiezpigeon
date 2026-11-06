# Listing analysis: the "About this listing" card

Status: approved by the author on 2026-11-06, with the greeting line
display-only. Written from a brainstorm; the Phase 13 spec in `PHASES.md`
is derived from it.

## Intent

When the panel opens on a listing, the user wants to know what they are
looking at before they ask for a letter: what kind of rental it is, how its
price sits against the neighbourhood, and whether anything on the page
deserves a second look before they write to a stranger. Today the panel
says "Listing detected" and the fit check, and nothing else.

The trigger was a real listing that looked expensive for its Kiez, named its
contact as "Herr" with a first name that did not obviously fit, and never
said plainly what kind of rental it was. The user wants to be told such
things, not judged for them.

## Goals

- Tell the user, on the Listing detected screen, what the page says about
  the kind of rental, the price against nearby offers, and anything worth a
  second look.
- Every line is traceable to something on the page. Unknown stays unknown.
- Calm, factual wording. The card informs; the user decides.

## Non-goals

- Changing the letter flow in any way. The card never blocks, hides or
  reorders "Write my letter", and never touches the fit check.
- Detecting fraud. The card lists what the page says and why it can
  matter. It names no verdict.
- Market data. No bundled rent table, no Mietspiegel, no network call.
  The only price reference is the one the page itself prints.

## Anti-goals (a failure even if it works)

- A single number or score, a meter, a traffic light. Status is never
  colour alone, and a score reads as a verdict the user did not ask for.
- The words scam, fraud, Betrug or warning in the UI. The heading is
  "Worth a second look", and each line says what the page says and why it
  matters, in at most two sentences.
- A guessed fact. The card never infers gender from a first name, never
  estimates a price without a figure from the page, never says
  "unbefristet" because the page did not say "befristet".
- Any new network request or stored data. The analysis is computed from
  the `Listing` the adapter already handed over and is not saved.

## What the user sees

A card titled **About this listing** on the Listing detected screen, between
the stat tiles and the fit check card, on every site with an adapter. On
the unknown-site flow, where the user typed the facts, the card is not
shown (my call: there is no page text to analyse, and a card that says
"nothing known" three times is noise).

Four lines or groups, in this order:

1. **Kind of rental.** One line built only from positive signals the page
   gives: "Möbliert, Zwischenmiete, befristet" or "Genossenschaft, WBS
   required" or "Erstbezug". With none it reads "The page names no special
   form of rental: no Untermiete, Zwischenmiete, WG, möbliert,
   Genossenschaft or WBS." The flat type the page states (Etagenwohnung,
   Dachgeschoss, Maisonette) and who offers it ("offered privately",
   "offered by a company") are shown on the same line when read. When the
   page's description could not be read, the line says so instead:
   "I could not read this page's description." (status `unknown`).
2. **Price.** "Kaltmiete 19,99 €/m². Nearby offers average 9,70 €/m²
   (ImmoScout24, 500 flats within 1000 m), so this is well above." The
   verdict word comes from the rule's thresholds (below). On a page without
   a comparison: "Kaltmiete 12,60 €/m². This page shows no comparison."
   English ImmoScout24 pages print no comparison (checked in the fixture).
3. **Greeting.** Shown whenever a contact person was read: "The letter
   will greet 'Sehr geehrter Herr Muster'." Display only (see Decisions
   left to the author). It sits here, not under the second look, so a
   normal contact never counts as something odd.
4. **Worth a second look.** Zero or more lines, each with the exclamation
   icon in the design system's warning role. With none, one line with the
   tick icon: "Nothing on the page stood out."

Icons: the second-look lines carry the exclamation, the empty second look
the tick, and a price line at "well above" or "well below" the
exclamation. The kind, greeting and other price lines carry their label
word ("Kind", "Price", "Greeting") as the marker instead of an icon, since
a tick would read as approval and an info glyph would be a new icon. (My
call.) Example lines, as copy:

- "Kaution is 4.500 €, more than three Kaltmieten. Three is the legal
  maximum (§ 551 BGB)."
- "The text mentions a Provision. Tenants pay none for a rental since 2015
  (Bestellerprinzip)."
- "The text says no viewing is possible. Seeing the flat before any payment
  is normal."
- "The text asks for a payment or deposit before a viewing."
- "The text says the landlord is abroad."
- "Nebenkosten are 420 €, over half the Kaltmiete. Ask what they include."
- "Much cheaper than nearby offers. Worth asking why."

The deposit note is not shown when the page reads as a Genossenschaft:
ImmoScout24's one row holds either the Kaution or the cooperative shares,
which are routinely above three Kaltmieten and outside § 551 BGB. (My call,
from the fixtures.)

## How it is made

### Rules (strict test-first tier)

`src/rules/analysis.ts`, pure, taking a `Listing` and returning plain data:

```ts
interface Analysis {
  kind: Line; // one line, status "info" | "unknown"
  price: Line; // one line, status "info" | "note" | "unknown"
  greeting?: Line; // status "info"; absent without a contact person
  notes: Line[]; // "Worth a second look"; empty means nothing stood out
}
interface Line {
  id: string;
  status: "info" | "note" | "unknown";
  text: string;
}
```

The price line is a `note` only at "well above" and "well below".

`rentalHints(text: string)` is also a rule: German or English page text in,
flags out (`sublet`, `interim`, `fixedTerm`, `furnished`, `sharedFlat`,
`cooperative`, `wbs`, `firstOccupancy`, `staffel`, `index`, `commission`,
`noViewing`, `paymentFirst`, `abroad`). Negations are handled for the
flags where they are common on real pages: "provisionsfrei" and "keine
Provision" do not set `commission`; "nicht möbliert" does not set
`furnished`. The keyword lists live in the rule file with a comment per
entry saying which fixture or probe showed it.

Price verdict thresholds, on Kaltmiete per m² against the page's average:
well above at +25 % and more, above from +10 %, around within ±10 %,
below from −10 %, well below at −25 % and less. "Well below" also adds the
"much cheaper" note. Thresholds are constants in the rule, tested at the
boundaries. (My call; easy to retune.)

Deposit note at `kautionCents > 3 × kaltmieteCents`. Nebenkosten note at
`nebenkostenCents > kaltmieteCents / 2` (my call).

### Listing fields (ADR 8 amendment, same commit)

`Listing` gains, all optional, each in `missing` when a page lacks it:

- `flatType?: string` as the page states it (Etagenwohnung, Dachgeschoss).
- `kautionCents?: Cents`.
- `priceComparison?: { averageCentsPerM2: Cents; radiusM: number; sampleSize: number }`
  from ImmoScout24's "Preis- und Lageinformationen" block, which every
  probe page and fixture shows. Vonovia and Deutsche Wohnen print none.
- `offeredBy?: "private" | "commercial"`, from ImmoScout24's marker beside
  the contact: "von privat" in the private-offer logo (shown in
  `listing-missing-fields.html`) or "Gewerblich" in the verified box
  (`listing-complete.html`). It feeds the kind line only.
- `hints?: RentalHints` from `rentalHints` over the description, the
  "Sonstiges" row and the boolean criteria tags, so the analysis rule
  never sees raw text. Absent, with `description` in `missing`, when the
  page's description could not be found; the kind line is then `unknown`.
  The typed-facts listing of the unknown-site flow never has it.

### Adapters (tests after, against fixtures)

ImmoScout24 reads the rows `Typ`, `Objektzustand` (Erstbezug), `Kaution o.
Genossenschaftsanteile`, the price block's three figures, the contact
marker, and hands the description and "Sonstiges" text to `rentalHints`.
Vonovia and Deutsche Wohnen read `Art` and `Kaution` through the shared
platform builder and hand their description text to `rentalHints`. The
generic reader stays as it is.

### UI (one smoke test, plus the fixture page in Chrome)

`src/ui/screens/ListingDetected/AnalysisCard.tsx` renders the three
groups with the existing Card, check-line styles and icons. No new
component, no new tokens. The card never changes the screen's one teal
button.

### ADR 14

"Listing analysis reads the page only": no bundled market data, no network,
no stored result; the rejected alternatives (a bundled per-district table,
asking Claude) and why. Recorded in the commit that adds the rule.

## Constraints

Everything in `CLAUDE.md` holds: rules pure, adapters fixture-tested,
personal data scrubbed, no new permission, no new network destination, no
new stored field (the analysis is not saved; `Application` is unchanged).
Copy in sentence case, "you", German market terms kept, no em dashes.

## Process

This is Phase 13. The same PR carries the Phase 13 spec in `PHASES.md`
(derived from this document), the PLAN.md Tier 2 line and build-order
row, and ADR 14, as Phases 9 to 12 did. No new fixture is needed: the
existing ImmoScout24 fixtures show the price block, the private and the
commercial marker, a Genossenschaft row and a "möbliert" description.

## Decisions left to the author

- **The greeting line.** Default in this design: the line only shows how
  the letter will greet the contact, so a wrong salutation is seen before
  it is written. The alternative is a Frau/Herr switch next to it that
  overrides the salutation for the letter. The switch is small but is the
  only part of this feature that touches the letter: the letter request,
  the salutation check in the validator and the resume of the last letter
  for a listing all read the contact person.

## Left to the builder

Exact selectors; the keyword lists and their fixture comments; the line
ids; which icon size the check lines use; whether `rentalHints` and the
analysis rule share one file or two; the order of notes when several
apply (suggested: money first, then viewing and payment, then the
greeting).
