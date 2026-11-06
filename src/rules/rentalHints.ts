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
 * so "provisionsfrei" never counts as a Provision, "unbefristet" never as
 * befristet, "Kein WBS erforderlich" never as WBS, and "WG-geeignet" or
 * "Suitable for shared flats" (the ImmoScout24 feature tag in either
 * language) never as a WG room. One test per phrasing in the test file; an
 * over-flag would be a wrong claim on the card, so this list grows with
 * every phrasing a page shows.
 */
const NEGATIONS =
  /provisionsfrei|keine provision|ohne provision|courtagefrei|keine courtage|commission[- ]free|no commission|nicht möbliert|unmöbliert|unfurnished|not furnished|wg-geeignet|suitable for (?:a )?shared flats?|flat[- ]share suitable|unbefristet\w*|kein(?:en|e)? wbs\b|wbs (?:ist )?nicht erforderlich|kein wohnberechtigungsschein|wohnberechtigungsschein (?:ist )?nicht erforderlich|keine untervermietung|untervermietung (?:ist )?nicht (?:gestattet|erlaubt|möglich)|nicht für wohngemeinschaften|keine wohngemeinschaft\w*|keine wg\b|keine? (?:staffel|index)miete|kein erstbezug|cooperative shares/gi;

const PATTERNS: Readonly<Record<keyof RentalHints, RegExp>> = {
  sublet: /untermiete|untervermiet|\bsublet/i,
  interim: /zwischenmiete|interim (?:let|rent|tenancy)/i,
  fixedTerm: /(?<!un)befristet|zeitmietvertrag|fixed[- ]term/i,
  // "Teilmöbliert" in a fixture title counts: partly furnished is furnished.
  furnished: /möbliert|moebliert|furnished/i,
  sharedFlat:
    /wg-zimmer|zimmer in (?:einer |der )?wg\b|wohngemeinschaft|shared flat|flat ?share/i,
  // The Kosten row is labelled "Kaution o. Genossenschaftsanteile" on every
  // ImmoScout24 page; only the cooperative itself counts.
  cooperative: /genossenschaft(?!s?anteil)|cooperative/i,
  wbs: /wohnberechtigungsschein|\bwbs\b/i,
  // The English fixture's condition row: "First-time occupancy after refurbishment".
  firstOccupancy: /erstbezug|first[- ]time occupancy|first occupancy/i,
  staffel: /staffelmiete/i,
  index: /indexmiete/i,
  // The complete fixture rules a Provision out under § 2 WoVermG; see NEGATIONS.
  commission: /\bprovision\b|courtage|maklergebühr|\bcommission\b/i,
  // "Besichtigungsanfragen" is a plea, not a refusal: no "s" may follow.
  noViewing:
    /keine besichtigung(?!s)|ohne besichtigung(?!s)|besichtigung(?:en)? (?:ist |sind |derzeit |leider )*nicht möglich|no viewing(?!s)|without (?:a )?viewing|viewing (?:is )?not possible/i,
  // A payment word and the timing together, in either order; "before the
  // viewing" alone is how a landlord asks for documents.
  paymentFirst:
    /(?:kaution|miete|geld|betrag|zahlung|deposit|payment|rent|money)\W+(?:\w+\W+){0,6}?(?:vor der besichtigung|vorab|before (?:the |a )?viewing)|(?:vor der besichtigung|vorab|before (?:the |a )?viewing)\W+(?:\w+\W+){0,4}?(?:überweis\w*|zahlen|bezahlen|paid|pay|transfer\w*)|vorkasse|western union|moneygram/i,
  // The landlord abroad, not applicants from abroad.
  abroad:
    /(?:ich|wir|vermieter\w*|eigentümer\w*|besitzer\w*)\W+(?:\w+\W+){0,5}?(?:im ausland|nicht in deutschland)|(?:i am|i'm|we are|we're|owner is|landlord is)\W+(?:\w+\W+){0,4}?(?:abroad|out of the country|not in germany)/i,
};

export function rentalHints(text: string): RentalHints {
  const cleaned = text.replace(NEGATIONS, " ");
  const hints = { ...NO_HINTS };
  for (const flag of Object.keys(PATTERNS) as (keyof RentalHints)[]) {
    hints[flag] = PATTERNS[flag].test(cleaned);
  }
  return hints;
}
