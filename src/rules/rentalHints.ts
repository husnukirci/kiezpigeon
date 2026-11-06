// What a listing's free text says about the kind of rental (Phase 13):
// German or English page text in, flags out. The analysis rule reads only
// these flags, never the text. Each pattern notes where it was seen.
import type { RentalHints } from "./types";

/** Every flag off: plain text that names no special form of rental. */
export const NO_HINTS: RentalHints = {
  sublet: false,
  interim: false,
  fixedTerm: false,
  furnished: false,
  sharedFlat: false,
  cooperative: false,
  wbs: false,
  firstOccupancy: false,
  staffel: false,
  index: false,
  commission: false,
  noViewing: false,
  paymentFirst: false,
  abroad: false,
};

/**
 * Phrases that rule a thing out, removed before the positive patterns run,
 * so "provisionsfrei" never counts as a Provision and "WG-geeignet" (the
 * ImmoScout24 feature tag) never counts as a WG room.
 */
const NEGATIONS =
  /provisionsfrei|keine provision|ohne provision|courtagefrei|keine courtage|commission[- ]free|no commission|nicht möbliert|unmöbliert|unfurnished|wg-geeignet|suitable for (?:a )?shared flats?|flat[- ]share suitable/gi;

const PATTERNS: Readonly<Record<keyof RentalHints, RegExp>> = {
  sublet: /untermiete|untervermiet|\bsublet/i,
  interim: /zwischenmiete|interim (?:let|rent|tenancy)/i,
  fixedTerm: /befristet|zeitmietvertrag|fixed[- ]term/i,
  // "Teilmöbliert" in a fixture title counts: partly furnished is furnished.
  furnished: /möbliert|moebliert|furnished/i,
  sharedFlat:
    /wg-zimmer|zimmer in (?:einer |der )?wg\b|wohngemeinschaft|shared flat|flat ?share/i,
  // The Kosten row is labelled "Kaution o. Genossenschaftsanteile" on every
  // ImmoScout24 page; only the cooperative itself counts.
  cooperative: /genossenschaft(?!s?anteil)/i,
  wbs: /wohnberechtigungsschein|\bwbs\b/i,
  // The English fixture's condition row: "First-time occupancy after refurbishment".
  firstOccupancy: /erstbezug|first[- ]time occupancy|first occupancy/i,
  staffel: /staffelmiete/i,
  index: /indexmiete/i,
  // The complete fixture rules a Provision out under § 2 WoVermG; see NEGATIONS.
  commission: /\bprovision\b|courtage|maklergebühr|\bcommission\b/i,
  noViewing:
    /keine besichtigung|ohne besichtigung|besichtigung(?:en)? (?:ist |sind |derzeit )?nicht möglich|no viewing|without (?:a )?viewing|viewing (?:is )?not possible/i,
  paymentFirst:
    /vorab (?:zu )?(?:überweisen|zahlen|bezahlen)|vorkasse|anzahlung|western union|moneygram|paypal|airbnb|before (?:the |a )?viewing|wire transfer/i,
  abroad: /im ausland|nicht in deutschland|\babroad\b|out of the country/i,
};

export function rentalHints(text: string): RentalHints {
  const cleaned = text.replace(NEGATIONS, " ");
  const hints = { ...NO_HINTS };
  for (const flag of Object.keys(PATTERNS) as (keyof RentalHints)[]) {
    hints[flag] = PATTERNS[flag].test(cleaned);
  }
  return hints;
}
