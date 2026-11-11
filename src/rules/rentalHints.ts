// What a listing's free text says about the kind of rental (Phase 13):
// German or English page text in, flags out. The analysis rule reads only
// these flags, never the text. Each pattern notes where it was seen.
import type { Listing, RentalHints } from "./types";

/** Every flag off: plain text that names no special form of rental. */
export const NO_HINTS: RentalHints = {
  sublet: false,
  interim: false,
  fixedTerm: false,
  furnished: false,
  sharedFlat: false,
  cooperative: false,
  wbs: false,
  wbsMentioned: false,
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
const RULED_OUT_TERMS =
  "zwischenmiete|untermiete|untervermietung|befristet|maklergebühr|provision|courtage|commission|staffelmiete|indexmiete|möbliert";

const LISTED_NEGATIONS =
  /provisionsfrei|keine provision|ohne provision|courtagefrei|keine courtage|commission[- ]free|no commission|nicht möbliert|unmöbliert|unfurnished|not furnished|wg-geeignet|suitable for (?:a )?shared flats?|flat[- ]share suitable|unbefristet\w*|kein(?:en|e)? wbs\b|wbs (?:ist )?nicht erforderlich|kein wohnberechtigungsschein|wohnberechtigungsschein (?:ist )?nicht erforderlich|keine untervermietung|untervermietung (?:ist )?nicht (?:gestattet|erlaubt|möglich)|nicht für wohngemeinschaften|keine wohngemeinschaft\w*|keine wg\b|keine? (?:staffel|index)miete|kein erstbezug|cooperative shares/gi;

const NEGATIONS = new RegExp(
  [
    // One general negation: a negator directly before a rental term, or a
    // term whose clause says it is not charged. From the 2026-11-10 audit.
    `\\b(?:keine?[mnrs]?|nicht|ohne|no|not|without)\\s+(?:${RULED_OUT_TERMS})\\w*`,
    `\\b(?:${RULED_OUT_TERMS})\\w*[^.!?]{0,40}?(?:fällt nicht an|wird nicht (?:erhoben|verlangt|berechnet))`,
    // "Für Wohngemeinschaften geeignet" is the feature tag, not a WG room.
    // From the 2026-11-10 audit.
    "für (?:eine |)(?:wg|wohngemeinschaft\\w*) geeignet",
    LISTED_NEGATIONS.source,
  ].join("|"),
  "gi",
);

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
  // Required only with a requirement word nearby: a listing rented "ohne
  // WBS-Anspruch" or asking whether you are "WBS-berechtigt" mentions a
  // WBS without asking for one.
  wbs: /(?:wohnberechtigungsschein|\bwbs\b)[^.]{0,40}?(?:erforderlich|notwendig|nötig|zwingend|voraussetzung|required|needed|necessary)|(?:nur mit|only with)[^.]{0,20}?(?:wohnberechtigungsschein|\bwbs\b)/i,
  // On the raw text, so a WBS ruled out still counts as mentioned.
  wbsMentioned: /wohnberechtigungsschein|\bwbs\b/i,
  // The English fixture's condition row: "First-time occupancy after refurbishment".
  firstOccupancy: /erstbezug|first[- ]time occupancy|first occupancy/i,
  staffel: /staffelmiete/i,
  index: /indexmiete/i,
  // The complete fixture rules a Provision out under § 2 WoVermG; see NEGATIONS.
  commission: /\bprovision\b|courtage|maklergebühr|\bcommission\b/i,
  // "Besichtigungsanfragen" is a plea, not a refusal: no "s" may follow.
  noViewing:
    /keine besichtigung(?!s)(?! ohne)|ohne besichtigung(?!s)|besichtigung(?:en)? (?:ist |sind |derzeit |leider )*nicht möglich|no viewing(?!s)|without (?:a )?viewing|viewing (?:is )?not possible/i,
  // A payment word and the timing together, in either order; "before the
  // viewing" alone is how a landlord asks for documents.
  // The payment word is a whole word ("Kaltmiete" is not "Miete"), the gap
  // stays inside one sentence, and a sentence about monthly rent ("monatlich
  // vorab") is the usual rent clause. From the 2026-11-10 audit.
  paymentFirst:
    /(?<![^.!?]*\bmonatlich\b[^.!?]*)\b(?:kaution|miete|geld|betrag|zahlung|deposit|payment|rent|money)\b(?![^.!?]*\bmonatlich\b)[^\w.!?]+(?:\w+[^\w.!?]+){0,6}?(?:vor der besichtigung|vorab|before (?:the |a )?viewing)|(?<![^.!?]*\bmonatlich\b[^.!?]*)(?:vor der besichtigung|vorab|before (?:the |a )?viewing)(?![^.!?]*\bmonatlich\b)\W+(?:\w+\W+){0,4}?(?:überweis\w*|zahlen|bezahlen|paid|pay|transfer\w*)|vorkasse|western union|moneygram/i,
  // The landlord abroad, not applicants from abroad.
  abroad:
    /(?:\bich\b|\bwir\b|vermieter\w*|eigentümer\w*|besitzer\w*)\W+(?:\w+\W+){0,5}?(?:im ausland|nicht in deutschland)|\b(?:i am|i'm|we are|we're|owner is|landlord is)\W+(?:\w+\W+){0,4}?(?:abroad|out of the country|not in germany)/i,
};

export function rentalHints(text: string): RentalHints {
  const cleaned = text.replace(NEGATIONS, " ");
  const hints = { ...NO_HINTS };
  for (const flag of Object.keys(PATTERNS) as (keyof RentalHints)[]) {
    const source = flag === "wbsMentioned" ? text : cleaned;
    hints[flag] = PATTERNS[flag].test(source);
  }
  return hints;
}

/**
 * Whether the flat needs a WBS: the page's own row when it has one, else
 * what its text asks for, else unknown. The card and the fit check both
 * read WBS only through this.
 */
export function wbsRequiredOf(
  listing: Pick<Listing, "wbsRequired" | "hints">,
): boolean | undefined {
  if (listing.wbsRequired !== undefined) return listing.wbsRequired;
  return listing.hints?.wbs ? true : undefined;
}
