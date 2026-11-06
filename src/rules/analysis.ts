// "About this listing" (Phase 13, ADR 14): what the page says about the
// kind of rental, where its Kaltmiete sits against the band the page itself
// prints, how the letter will greet the contact, and what is worth a second
// look. It informs; it never blocks writing a letter and never claims more
// than the page shows. Every line is UI copy.
import { formatEuro, formatEuroPerM2 } from "./format";
import { namedContact, salutationFor } from "./letterPrompt";
import type {
  Analysis,
  AnalysisLine,
  Cents,
  Listing,
  RentalHints,
} from "./types";

/** At this share over the band's top the price is "well above". */
const WELL_ABOVE = 1.25;
/** At this share under the band's bottom the price is "well below". */
const WELL_BELOW = 0.75;
/** § 551 BGB: a Kaution of at most three Kaltmieten. */
const DEPOSIT_MAX_MONTHS = 3;
/** Nebenkosten over this share of the Kaltmiete are worth a question. */
const UTILITIES_SHARE = 0.5;

const NO_KIND =
  "The page names no special form of rental: no Untermiete, Zwischenmiete, WG, möbliert, Genossenschaft or WBS.";

/** The kind line's parts, in the order they are listed. */
const KIND_PARTS: readonly [keyof RentalHints, string][] = [
  ["firstOccupancy", "Erstbezug"],
  ["furnished", "Möbliert"],
  ["sharedFlat", "WG-Zimmer"],
  ["sublet", "Untermiete"],
  ["interim", "Zwischenmiete"],
  ["fixedTerm", "befristet"],
  ["cooperative", "Genossenschaft"],
  ["wbs", "WBS required"],
  ["staffel", "Staffelmiete"],
  ["index", "Indexmiete"],
];

/** Whole cents per square metre; nothing without an area. */
export function centsPerM2(
  kaltmieteCents: Cents,
  areaM2: number,
): Cents | undefined {
  if (areaM2 <= 0) return undefined;
  return Math.round(kaltmieteCents / areaM2);
}

function kindLine(listing: Listing): AnalysisLine {
  const { hints, flatType, offeredBy } = listing;
  if (hints === undefined) {
    return {
      id: "kind",
      status: "unknown",
      text: "I could not read this page's description.",
    };
  }
  const parts = KIND_PARTS.filter(
    ([flag, word]) =>
      hints[flag] || (word === "WBS required" && listing.wbsRequired === true),
  ).map(([, word]) => word);
  const offered =
    offeredBy === "private"
      ? "offered privately"
      : offeredBy === "commercial"
        ? "offered by a company"
        : undefined;
  const facts = [flatType, ...parts, offered].filter(
    (part): part is string => part !== undefined,
  );
  const text =
    parts.length > 0
      ? `${facts.join(", ")}.`
      : facts.length > 0
        ? `${facts.join(", ")}. ${NO_KIND}`
        : NO_KIND;
  return { id: "kind", status: "info", text };
}

function priceLine(listing: Listing): AnalysisLine {
  const { kaltmieteCents, areaM2, priceComparison: band } = listing;
  const own =
    kaltmieteCents === undefined || areaM2 === undefined
      ? undefined
      : centsPerM2(kaltmieteCents, areaM2);
  if (own === undefined) {
    return {
      id: "price",
      status: "unknown",
      text: "Kaltmiete or size not shown, so no price per m².",
    };
  }
  const figure = `Kaltmiete ${formatEuroPerM2(own)}.`;
  if (band === undefined) {
    return {
      id: "price",
      status: "info",
      text: `${figure} This page shows no comparison.`,
    };
  }
  const verdict = priceVerdict(own, band.lowCentsPerM2, band.highCentsPerM2);
  // The unit once, at the end of the band: "14,00 to 21,00 €/m²".
  const low = formatEuroPerM2(band.lowCentsPerM2).replace(/ €\/m²$/, "");
  const where = `Nearby offers mostly run ${low} to ${formatEuroPerM2(band.highCentsPerM2)} (${band.sampleSize} flats within ${band.radiusM} m on this site)`;
  return {
    id: "price",
    status: verdict.startsWith("well") ? "note" : "info",
    text: `${figure} ${where}: ${verdict} the usual range.`,
  };
}

function priceVerdict(own: Cents, low: Cents, high: Cents): string {
  if (own >= high * WELL_ABOVE) return "well above";
  if (own > high) return "above";
  if (own <= low * WELL_BELOW) return "well below";
  if (own < low) return "below";
  return "within";
}

function greetingLine(listing: Listing): AnalysisLine | undefined {
  if (namedContact(listing.contactPerson) === undefined) return undefined;
  const greeting = salutationFor(listing.contactPerson).replace(/,$/, "");
  return {
    id: "greeting",
    status: "info",
    text: `The letter will greet "${greeting}".`,
  };
}

function notes(listing: Listing, price: AnalysisLine): AnalysisLine[] {
  const {
    kaltmieteCents: kalt,
    kautionCents,
    nebenkostenCents,
    hints,
  } = listing;
  const lines: AnalysisLine[] = [];
  const note = (id: string, text: string): void => {
    lines.push({ id, status: "note", text });
  };
  // On ImmoScout24 the Kaution row holds a cooperative's shares instead,
  // which § 551 BGB does not cap.
  if (
    kalt !== undefined &&
    kautionCents !== undefined &&
    kautionCents > kalt * DEPOSIT_MAX_MONTHS &&
    hints?.cooperative !== true
  ) {
    note(
      "deposit",
      `Kaution is ${formatEuro(kautionCents)}, more than three Kaltmieten (${formatEuro(kalt * DEPOSIT_MAX_MONTHS)}). Three is the legal maximum (§ 551 BGB).`,
    );
  }
  if (
    kalt !== undefined &&
    nebenkostenCents !== undefined &&
    nebenkostenCents > kalt * UTILITIES_SHARE
  ) {
    note(
      "utilities",
      `Nebenkosten are ${formatEuro(nebenkostenCents)}, over half the Kaltmiete. Ask what they include.`,
    );
  }
  if (hints?.commission) {
    note(
      "commission",
      "The text mentions a Provision. Tenants pay none for a rental since 2015 (Bestellerprinzip).",
    );
  }
  if (hints?.noViewing) {
    note(
      "noViewing",
      "The text says no viewing is possible. Seeing the flat before any payment is normal.",
    );
  }
  if (hints?.paymentFirst) {
    note(
      "paymentFirst",
      "The text asks for a payment or deposit before a viewing.",
    );
  }
  if (hints?.abroad) note("abroad", "The text says the landlord is abroad.");
  if (price.text.includes("well below")) {
    note("cheap", "Much cheaper than nearby offers. Worth asking why.");
  }
  return lines;
}

export function analyseListing(listing: Listing): Analysis {
  const price = priceLine(listing);
  const greeting = greetingLine(listing);
  return {
    kind: kindLine(listing),
    price,
    ...(greeting && { greeting }),
    notes: notes(listing, price),
  };
}
