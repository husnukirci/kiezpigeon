# Listing Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "About this listing" card on the Listing detected screen that says, from the page alone, what kind of rental it is, how its Kaltmiete sits against the page's own price band, how the letter will greet the contact, and what is worth a second look.

**Architecture:** Adapters read five new optional `Listing` fields (flat type, Kaution, who offers, the price band, rental hints scanned from the page text). A pure rule, `analyseListing`, turns a `Listing` into plain lines. One card component renders them. Nothing is stored, no network, the letter flow is untouched.

**Tech Stack:** TypeScript strict, Vitest + happy-dom, React 19, CSS Modules on the token file, WXT build. Fixtures under `fixtures/<site>/`.

**Spec:** `docs/superpowers/specs/2026-11-06-listing-analysis-design.md`

## Global Constraints

- `src/rules/` imports only from `src/rules/`; adapters may import rules, never UI or storage (ADR 6, ESLint enforced).
- Rules are pure: no `chrome.*`, DOM, network, clock or randomness.
- Money is integer cents; formatting to `19,99 €/m²` happens in `src/rules/format.ts` and the UI.
- UI copy: sentence case, "you", no em dashes, German market terms kept; the words scam, fraud, Betrug and warning never appear.
- No raw hex, sizes or spacings in CSS: `var(--…)` from `src/styles/tokens.css` only.
- No real personal data anywhere; fixtures are already scrubbed and no new fixture is added.
- Commits are `type(scope): subject`, one logical change each, no AI attribution trailer.
- Every task ends green: `npm test` (typecheck + Vitest) and `npm run lint`.

## Review Focus

1. A Kaltmiete with an area of `0` or missing: the price line must say the figure is not shown, never divide by zero (Task 3).
2. The Kosten row "Kaution o. Genossenschaftsanteile" with a bare number and no euro sign, as the sparse fixture has it: read as cents or left missing, never NaN (Task 4).
3. The complete fixture's sentence "Wir vermieten provisionsfrei … dürfen keine Provision von Ihnen verlangen" must not raise the Provision note (Task 2).
4. A page whose description block is gone: `hints` missing and the kind line `unknown`, not "no special form of rental" (Task 4).
5. The unknown-site flow, where the user typed the facts: no card at all (Task 6).

---

### Task 1: Types, formatting and the field lists

**Files:**

- Modify: `src/rules/types.ts` (after `Listing`, around line 105-125)
- Modify: `src/rules/format.ts`, `src/rules/format.test.ts`
- Modify: `src/adapters/listing.ts` (`LISTING_FIELDS`)
- Modify: `src/rules/typedListing.ts` (`FACT_FIELDS`), `src/rules/typedListing.test.ts`
- Create: `src/rules/rentalHints.ts` (only `NO_HINTS` for now; Task 2 adds the function)
- Modify: `test-support/sample-profiles.ts` (`kreuzbergListing`, `sparseListing`)
- Modify: the `missing` arrays in `src/adapters/immoscout24/immoscout24.test.ts`, `src/adapters/vonovia/vonovia.test.ts`, `src/adapters/deutsche-wohnen/deutscheWohnen.test.ts`, `src/adapters/generic/generic.test.ts` if it asserts one

**Interfaces:**

- Produces, in `src/rules/types.ts`:

```ts
export interface RentalHints {
  sublet: boolean; interim: boolean; fixedTerm: boolean; furnished: boolean;
  sharedFlat: boolean; cooperative: boolean; wbs: boolean; firstOccupancy: boolean;
  staffel: boolean; index: boolean; commission: boolean; noViewing: boolean;
  paymentFirst: boolean; abroad: boolean;
}
export interface PriceComparison {
  lowCentsPerM2: Cents; highCentsPerM2: Cents; radiusM: number; sampleSize: number;
}
// On Listing, all optional, in LISTING_FIELDS order after contactPerson:
flatType?: string; kautionCents?: Cents; offeredBy?: "private" | "commercial";
priceComparison?: PriceComparison; hints?: RentalHints;
export type AnalysisStatus = "info" | "note" | "unknown";
export interface AnalysisLine { id: string; status: AnalysisStatus; text: string }
export interface Analysis { kind: AnalysisLine; price: AnalysisLine; greeting?: AnalysisLine; notes: AnalysisLine[] }
```

- Produces `formatEuroPerM2(centsPerM2: Cents): string` in `src/rules/format.ts`, e.g. `1999` → `19,99 €/m²`.
- Produces `export const NO_HINTS: RentalHints` (every flag `false`) in `src/rules/rentalHints.ts`.

- [ ] **Step 1: Write the failing format test** in `src/rules/format.test.ts`:

```ts
describe("formatEuroPerM2", () => {
  it("formats cents per square metre in German style", () => {
    expect(formatEuroPerM2(1999)).toBe("19,99 €/m²");
    expect(formatEuroPerM2(970)).toBe("9,70 €/m²");
    expect(formatEuroPerM2(1200)).toBe("12,00 €/m²");
  });
});
```

- [ ] **Step 2: Run it and see it fail**: `npx vitest run src/rules/format.test.ts` → FAIL, `formatEuroPerM2` is not exported.
- [ ] **Step 3: Implement `formatEuroPerM2`** in `src/rules/format.ts`, always two decimals, via the file's existing number formatting.
- [ ] **Step 4: Run it green**: same command → PASS.
- [ ] **Step 5: Add the types** to `src/rules/types.ts` as in Interfaces, with a one-line doc comment per new `Listing` field saying which page block it comes from.
- [ ] **Step 6: Extend the field lists.** Append `"flatType", "kautionCents", "offeredBy", "priceComparison", "hints"` in that order to `LISTING_FIELDS` in `src/adapters/listing.ts` and to `FACT_FIELDS` in `src/rules/typedListing.ts`. In `test-support/sample-profiles.ts`, `kreuzbergListing` gains `flatType: "Etagenwohnung"`, `kautionCents: 354000`, `offeredBy: "commercial"`, `priceComparison: { lowCentsPerM2: 1400, highCentsPerM2: 2100, radiusM: 1000, sampleSize: 500 }` and `hints: NO_HINTS`; `sparseListing.missing` gains the five names at its end.
- [ ] **Step 7: Run the whole suite**: `npm test` → the adapter and typed-listing tests fail only on `missing` arrays. Append the five names, in order, to every asserted `missing` array (adapters list every field they did not find).
- [ ] **Step 8: Run green**: `npm test && npm run lint` → PASS.
- [ ] **Step 9: Commit**: `git commit -m "feat(rules): listing fields and types for the analysis card"`

### Task 2: `rentalHints`, text in, flags out (strict TDD)

**Files:**

- Create: `src/rules/rentalHints.ts`, `src/rules/rentalHints.test.ts`

**Interfaces:**

- Consumes `RentalHints` from Task 1.
- Produces `rentalHints(text: string): RentalHints` next to Task 1's `NO_HINTS`.

- [ ] **Step 1: Write the failing tests**, one `it` per flag, each with a German and an English phrase that sets it and one near miss that does not:

```ts
const only = (flag: keyof RentalHints) => ({ ...NO_HINTS, [flag]: true });
it("sees a sublet", () => {
  expect(rentalHints("Zur Untermiete für 6 Monate")).toEqual(only("sublet"));
  expect(rentalHints("Room to sublet in Wedding")).toEqual(only("sublet"));
});
it("sees an interim let and a fixed term", () => {
  expect(rentalHints("Zwischenmiete, befristet bis März")).toEqual({
    ...NO_HINTS,
    interim: true,
    fixedTerm: true,
  });
});
it("sees furnished, not unfurnished", () => {
  expect(rentalHints("Teilmöbliert 2 Zimmer")).toEqual(only("furnished"));
  expect(rentalHints("nicht möbliert").furnished).toBe(false);
  expect(rentalHints("unfurnished").furnished).toBe(false);
});
it("sees a WG room, not a flat that is WG-geeignet", () => {
  expect(rentalHints("WG-Zimmer in Neukölln")).toEqual(only("sharedFlat"));
  expect(rentalHints("WG-geeignet").sharedFlat).toBe(false);
});
it("sees a Genossenschaft, not the Kosten row's label", () => {
  expect(rentalHints("Wohnen bei der Genossenschaft")).toEqual(
    only("cooperative"),
  );
  expect(rentalHints("Kaution o. Genossenschaftsanteile").cooperative).toBe(
    false,
  );
});
it("sees WBS, Erstbezug, Staffelmiete and Indexmiete", () => {
  expect(rentalHints("Wohnberechtigungsschein erforderlich")).toEqual(
    only("wbs"),
  );
  expect(rentalHints("Erstbezug nach Sanierung")).toEqual(
    only("firstOccupancy"),
  );
  // The English fixture's condition row.
  expect(rentalHints("First-time occupancy after refurbishment")).toEqual(
    only("firstOccupancy"),
  );
  expect(rentalHints("Staffelmiete")).toEqual(only("staffel"));
  expect(rentalHints("Indexmiete")).toEqual(only("index"));
});
it("sees a Provision asked, not one ruled out", () => {
  expect(rentalHints("Provision: 2 Monatsmieten")).toEqual(only("commission"));
  expect(
    rentalHints(
      "Hinweis zu Ihrem Schutz: Wir vermieten provisionsfrei gemäß § 2 WoVermG. Personen, die im Auftrag tätig sind, dürfen keine Provision von Ihnen verlangen.",
    ).commission,
  ).toBe(false);
  expect(rentalHints("commission-free").commission).toBe(false);
});
it("sees no viewing, payment first and a landlord abroad", () => {
  expect(rentalHints("Eine Besichtigung ist nicht möglich")).toEqual(
    only("noViewing"),
  );
  expect(rentalHints("Kaution bitte vorab überweisen")).toEqual(
    only("paymentFirst"),
  );
  expect(rentalHints("payment via Western Union")).toEqual(
    only("paymentFirst"),
  );
  expect(rentalHints("Ich bin derzeit im Ausland")).toEqual(only("abroad"));
  expect(rentalHints("I am currently abroad")).toEqual(only("abroad"));
});
it("is all false for plain text", () => {
  expect(
    rentalHints(
      "Helle Wohnung mit Balkon und Holzdielen, ruhig zum Hof gelegen.",
    ),
  ).toEqual(NO_HINTS);
});
```

- [ ] **Step 2: Run and see them fail**: `npx vitest run src/rules/rentalHints.test.ts` → FAIL, module not found.
- [ ] **Step 3: Implement `rentalHints`** in `src/rules/rentalHints.ts`: one case-insensitive regex per flag in a table, a comment per entry naming the fixture or phrase that showed it; the negated Provision and furnished phrases are stripped from the text before the positive patterns run. Keyword choices beyond the tests are the implementer's.
- [ ] **Step 4: Run green**: same command → PASS. Then `npm test && npm run lint` → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(rules): rental hints scanned from a listing's text"`

### Task 3: `analyseListing` (strict TDD), ADR 14 and the ADR 8 amendment

**Files:**

- Create: `src/rules/analysis.ts`, `src/rules/analysis.test.ts`
- Modify: `docs/decisions.md` (amend ADR 8; add ADR 14 after ADR 13)

**Interfaces:**

- Consumes `Listing`, `Analysis`, `AnalysisLine`, `PriceComparison` (Task 1); `salutationFor`, `namedContact` from `src/rules/letterPrompt.ts`; `formatEuro`, `formatEuroPerM2` from `src/rules/format.ts`.
- Produces `analyseListing(listing: Listing): Analysis` and `centsPerM2(kaltmieteCents: Cents, areaM2: number): Cents | undefined` (undefined when `areaM2 <= 0`), both exported.

Exact copy the tests pin (ids in brackets):

- kind, no hints: `I could not read this page's description.` (status `unknown`)
- kind, hints all false, no flat type or offerer: `The page names no special form of rental: no Untermiete, Zwischenmiete, WG, möbliert, Genossenschaft or WBS.`
- kind with facts: `Etagenwohnung, offered by a company. ` + that sentence; with hints: `Etagenwohnung, Möbliert, Zwischenmiete, befristet, offered privately.` Parts in this order: Erstbezug, Möbliert, WG-Zimmer, Untermiete, Zwischenmiete, befristet, Genossenschaft, WBS required (from the hint or `wbsRequired === true`), Staffelmiete, Indexmiete; offerer `offered privately` / `offered by a company`.
- price unknown: `Kaltmiete or size not shown, so no price per m².`
- price, no comparison: `Kaltmiete 19,03 €/m². This page shows no comparison.`
- price with band: `Kaltmiete 19,03 €/m². Nearby offers mostly run 14,00 to 21,00 €/m² (500 flats within 1000 m on this site): within the usual range.` Verdict words: `well above the usual range` (own ≥ 1.25 × high, status `note`), `above the usual range` (own > high), `within the usual range`, `below the usual range` (own < low), `well below the usual range` (own ≤ 0.75 × low, status `note`, and the note [cheap] `Much cheaper than nearby offers. Worth asking why.`).
- greeting [greeting], only with a named contact: `The letter will greet "Sehr geehrte Frau Weber".` (the salutation line without its trailing comma).
- notes, in this order: [deposit] `Kaution is 4.500 €, more than three Kaltmieten (3.540 €). Three is the legal maximum (§ 551 BGB).` when `kautionCents > 3 × kaltmieteCents` and `hints?.cooperative !== true`; [utilities] `Nebenkosten are 700 €, over half the Kaltmiete. Ask what they include.` when `nebenkostenCents > kaltmieteCents / 2`; [commission] `The text mentions a Provision. Tenants pay none for a rental since 2015 (Bestellerprinzip).`; [noViewing] `The text says no viewing is possible. Seeing the flat before any payment is normal.`; [paymentFirst] `The text asks for a payment or deposit before a viewing.`; [abroad] `The text says the landlord is abroad.`; [cheap] last.

- [ ] **Step 1: Write the failing tests** in `src/rules/analysis.test.ts`, built on `kreuzbergListing` and `sparseListing` with spreads for each case: one `it` per bullet above asserting the exact `text` and `status`, one for the deposit note suppressed on `hints.cooperative`, one for the kind line's part order with every hint true, one for `centsPerM2(118000, 0)` being `undefined`, one for the band boundaries (own exactly `1.25 × high` is "well above", exactly `high` is "within", exactly `0.75 × low` is "well below").
- [ ] **Step 2: Run and see them fail**: `npx vitest run src/rules/analysis.test.ts` → FAIL, module not found.
- [ ] **Step 3: Implement** `src/rules/analysis.ts`: `centsPerM2`, one builder per line, `analyseListing` assembling them; thresholds as named constants `WELL_ABOVE = 1.25`, `WELL_BELOW = 0.75`, `DEPOSIT_MAX_MONTHS = 3`, `UTILITIES_SHARE = 0.5`.
- [ ] **Step 4: Run green**: same command → PASS; `npm test && npm run lint` → PASS.
- [ ] **Step 5: Write ADR 14** in `docs/decisions.md`, Nygard format, title "Listing analysis reads the page only": context (the user wants to know what they look at before writing), decision (a pure rule over the `Listing`; the only price reference is the band the page prints; nothing stored; no network; calm copy with no verdict), rejected (a bundled per-district rent table, which ages and needs an address; asking Claude, which adds a call and a guess; a score), consequences (sites without a band get "no comparison"; a changed page block degrades to `unknown`, never to a wrong claim), running probe: `src/rules/analysis.test.ts`. Amend ADR 8 with one dated paragraph listing the five new `Listing` fields and that `hints` is scanned text, never raw text, handed to the rule.
- [ ] **Step 6: Commit**: `git commit -m "feat(rules): analyse a listing into kind, price, greeting and notes"` (ADR files in the same commit).

### Task 4: ImmoScout24 reads the new fields (tests after, on fixtures)

**Files:**

- Modify: `src/adapters/immoscout24/immoscout24.ts` (`readListing`, the `found` block around line 143-201)
- Modify: `src/adapters/immoscout24/immoscout24.test.ts`

**Interfaces:**

- Consumes `rentalHints` (Task 2), `parseEuroText` / `parseEnglishEuro`, `textOf`, `firstText`, `rowByLabel`, `map` already in the file.
- Produces, on every ImmoScout24 `Listing`: `flatType` from `.is24qa-typ` or `.is24qa-type`; `kautionCents` from `.is24qa-kaution-o-genossenschaftsanteile` or `.is24qa-deposit`, else `rowByLabel(/kaution|deposit/i)`; `offeredBy` `"private"` when an element whose class contains `private-offer-logo-content` reads `von privat`, `"commercial"` when `.verifiedBox` reads `Gewerblich`; `priceComparison` from `#is24-expose-quickcheck`: sample size and radius from the two numbers in `[data-testid="quickcheck-intro"]`, low and high from the first `[data-testid="legend-item"]` inside `[data-testid="quickcheck-bar"]` (`[data-testid="left-value"]`, `[data-testid="right-value"]`), all four or nothing; `hints` from `rentalHints` over the joined text of `.expose-description-wrapper`, the `.is24qa-sonstiges` row, the condition row (`.is24qa-objektzustand` or `.is24qa-condition-of-the-property`) and the `#is24-boolean-criteria` tags, undefined when `.expose-description-wrapper` is absent.

- [ ] **Step 1: Extend the exact-listing tests.** Facts checked in the fixtures:
  - complete: `flatType: "Etagenwohnung"`, `kautionCents: 308487`, `offeredBy: "commercial"`, `priceComparison: { lowCentsPerM2: 970, highCentsPerM2: 1790, radiusM: 1000, sampleSize: 500 }`, `hints: NO_HINTS` (its description rules a Provision out; the test proves the negation holds on the real text), nothing of the five in `missing`.
  - missing-fields: no Typ row, so `flatType` stays in `missing`; `kautionCents: 100000` (the row reads a bare `1000`); `offeredBy: "private"`; `hints: NO_HINTS` (the Teilmöbliert is in the title only, which is not scanned); `priceComparison` in `missing` (its quickcheck block is empty).
  - English complete (`en-listing-complete.html`): `flatType: "Other"` (the `/en/` page keeps the `is24qa-typ` class), `kautionCents: 259500` (the row keeps the German number format on `/en/`, so it is parsed with `parseEuroText` whatever the page language), `hints: { ...NO_HINTS, firstOccupancy: true }` from the `is24qa-condition-of-the-property` row "First-time occupancy after refurbishment", `offeredBy` and `priceComparison` in `missing` unless the fixture shows a marker (check `.verifiedBox` there).
- [ ] **Step 2: Add two edge tests:** `reads no hints when the description block is gone` (load the complete fixture, `document.querySelector(".expose-description-wrapper")?.remove()`, expect `hints` undefined and `"hints"` in `missing`); `reads the Kosten row's bare number as euros` is covered by Step 1's `100000`; and `leaves the price band out when any of its four numbers is missing` (remove `[data-testid="quickcheck-intro"]`, expect no `priceComparison`).
- [ ] **Step 3: Run and see them fail**: `npx vitest run src/adapters/immoscout24` → FAIL on the new fields.
- [ ] **Step 4: Implement** the five reads in `readListing` as in Interfaces, next to the existing `found` entries, with a comment per selector naming the fixture it was seen in.
- [ ] **Step 5: Run green**: `npm test && npm run lint` → PASS.
- [ ] **Step 6: Commit**: `git commit -m "feat(adapters): immoscout24 reads type, kaution, offerer, price band and hints"`

### Task 5: Vonovia and Deutsche Wohnen read type, Kaution and hints

**Files:**

- Modify: `src/adapters/estatePlatform.ts` (`readListing`, around line 108-147)
- Modify: `src/adapters/vonovia/vonovia.test.ts`, `src/adapters/deutsche-wohnen/deutscheWohnen.test.ts`

**Interfaces:**

- Consumes `rentalHints` (Task 2), the file's `row`, `map`, `parseEuroText`.
- Produces `flatType` from `row("Art")`, `kautionCents` from `row("Kaution")`, `hints` from the `.rte` block under the `h2.headline` reading `Beschreibung` joined with the one under `Sonstige Angaben`, undefined when the Beschreibung block is absent. `offeredBy` and `priceComparison` stay in `missing`.

- [ ] **Step 1: Extend both complete-listing tests** with `flatType: "Etagenwohnung"`, `kautionCents` (Vonovia `296295`, Deutsche Wohnen `262962`), `hints: NO_HINTS` (both descriptions are one plain sentence); `missing` keeps `offeredBy`, `priceComparison`. Extend both sparse tests with what those fixtures hold: their `Beschreibung` block is present, so `hints: NO_HINTS`; assert `Art` and `Kaution` as the rows give them, or in `missing` when the rows are absent.
- [ ] **Step 2: Run and see them fail**: `npx vitest run src/adapters/vonovia src/adapters/deutsche-wohnen` → FAIL on the new fields.
- [ ] **Step 3: Implement** in `estatePlatform.ts`: a `descriptionOf(document)` helper that finds the headline by text and returns its card's `.rte` text, and the three new `found` entries.
- [ ] **Step 4: Run green**: `npm test && npm run lint` → PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(adapters): vonovia and deutsche wohnen read type, kaution and hints"`

### Task 6: The card on the Listing detected screen

**Files:**

- Create: `src/ui/screens/ListingDetected/AnalysisCard.tsx`
- Modify: `src/ui/screens/ListingDetected/ListingDetected.tsx` (render the card between `<StatRow>` and `<FitCard>`, only when `onEditFacts` is undefined)
- Modify: `src/ui/screens/ListingDetected/ListingDetected.module.css` (add `.marker`)
- Modify: `src/ui/screens/ListingDetected/ListingDetected.test.tsx`

**Interfaces:**

- Consumes `analyseListing` (Task 3), `Card`, `TickIcon`, `ExclamationIcon`, the screen's `.lines` / `.line` / `.label` styles.
- Produces `AnalysisCard({ listing }: { listing: Listing })`, a `Card` titled `About this listing`.

Rendering: one `<ul className={styles.lines}>` with the kind line, the price line and the greeting line when present; each `info` or `unknown` line starts with `<span className={cx(styles.marker, "type-label")}>Kind</span>` / `Price` / `Greeting`; a `note` price line starts with `<ExclamationIcon size={18} />` instead. Then `<p className={cx(styles.label, "type-label")}>Worth a second look</p>` and a second `<ul>`: one `<li>` per note with `<ExclamationIcon size={18} />`, or a single `<li>` with `<TickIcon size={18} />` and `Nothing on the page stood out.` `.marker` is `color: var(--ink-muted)` with `flex-shrink: 0` and a local `--marker-width: 64px` custom property as its `min-width`, in the module's existing style of a commented local size (`--icon-gap`, `--back-width`).

- [ ] **Step 1: Write the failing smoke tests** in `ListingDetected.test.tsx`:

```ts
it("tells what the listing is, how its price sits and what to look at twice", () => {
  render(<ListingDetected profile={coupleWithDog} siteName="ImmoScout24" listing={{ ...kreuzbergListing, kautionCents: 450000 }} onWrite={vi.fn()} />);
  const card = screen.getByRole("region", { name: "About this listing" });
  expect(card.textContent).toContain("Etagenwohnung, offered by a company.");
  expect(card.textContent).toContain("within the usual range");
  expect(card.textContent).toContain('The letter will greet "Sehr geehrte Frau Weber".');
  expect(card.textContent).toContain("more than three Kaltmieten");
  expect(card.textContent).not.toContain("Nothing on the page stood out");
});
it("says nothing stood out on a plain listing, and shows no card for typed facts", () => {
  const { unmount } = render(<ListingDetected profile={coupleWithDog} siteName="ImmoScout24" listing={kreuzbergListing} onWrite={vi.fn()} />);
  expect(screen.getByRole("region", { name: "About this listing" }).textContent).toContain("Nothing on the page stood out.");
  unmount();
  render(<ListingDetected profile={coupleWithDog} siteName="Example" listing={sparseListing} onEditFacts={vi.fn()} onWrite={vi.fn()} />);
  expect(screen.queryByRole("region", { name: "About this listing" })).toBeNull();
});
```

- [ ] **Step 2: Run and see them fail**: `npx vitest run src/ui/screens/ListingDetected` → FAIL, no region named "About this listing".
- [ ] **Step 3: Implement** `AnalysisCard.tsx` and wire it into the screen as in Interfaces; add `.marker` to the module CSS.
- [ ] **Step 4: Run green**: `npm test && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Check in Chromium** with the built extension: open the side panel on `fixtures/immoscout24/listing-complete.html` served locally (reuse the Playwright launch from `e2e/screenshots.spec.ts` in a scratchpad script) and confirm the card shows four lines plus "Nothing on the page stood out.", one teal button on the screen, and no console or page errors. Keep the screenshot out of the repo.
- [ ] **Step 6: Commit**: `git commit -m "feat(ui): the about-this-listing card"`

### Task 7: Phase bookkeeping, docs and release

**Files:**

- Modify: `PHASES.md` (append Phase 13), `PLAN.md` (Tier 2 line, build-order row `P13`, section 6 ADR 14 line), `README.md` (screen 2 sentence), `docs/ai-workflow.md` (friction lines from the build), `package.json` + `package-lock.json` (minor version)

- [ ] **Step 1: Write the Phase 13 spec** in `PHASES.md` in the house style (Context, Objective, In scope numbered as Tasks 1 to 6 above, Out of scope: the Frau/Herr switch, bundled market data, storing the analysis; Acceptance: on the complete ImmoScout24 fixture the card reads the four lines and the tick line; on the sparse fixture it reads "offered privately" and Teilmöbliert; Review checklist: no copy claims or judges, status never colour alone, the letter flow untouched, rules pure; PR title `feat(listing): the about-this-listing card`).
- [ ] **Step 2: PLAN.md**: Tier 2 `- [x] An "About this listing" card: kind of rental, price against the page's own band, greeting, things worth a second look (Phase 13)`; build-order row `| P13 | Listing analysis card from the page's own facts, ADR 14 | feat(listing) |`; section 6 line `ADR 14 (listing analysis reads the page only) was added in Phase 13.`
- [ ] **Step 3: README.md**: after the "Listing detected" screen sentence add one sentence: the card says what kind of rental it is, how the Kaltmiete sits against the offers the page compares it with, how the letter will greet the contact, and what is worth a second look; it informs, you decide.
- [ ] **Step 4: Friction log**: one `- P13 |` line per surprise met during Tasks 1 to 6 (a selector that was not where the fixture suggested, a keyword that misfired, a test that failed for the wrong reason), written when it happened, not reconstructed.
- [ ] **Step 5: Version**: `npm version minor --no-git-tag-version`, commit `chore(release): <version>`.
- [ ] **Step 6: Verify everything**: `npm test && npm run lint && npm run build && npm run test:e2e` → all PASS (the e2e suite is untouched but must stay green).
- [ ] **Step 7: Commit docs**: `git commit -m "docs: phase 13 spec, plan and readme for the listing analysis card"`, then open the PR with `gh pr create` using the Phase 13 PR title, a body in the style of PR #29 (What, Why, Changes, Checks, Review checklist), no AI attribution.
