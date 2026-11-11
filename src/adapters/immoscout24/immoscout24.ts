// ImmoScout24 exposé pages (ADR 8). Reads the `is24qa-*` classes and
// `data-qa` attributes the site uses for its own tests, then parses the
// text inside them, German or, on the site's `/en/` address, English. The
// page's tracking data and inline scripts are never read.
import { describeFields } from "../../fill/describe";
import { rentalHints } from "../../rules/rentalHints";
import type {
  Feature,
  Listing,
  PetPolicy,
  PriceComparison,
  RentalHints,
} from "../../rules/types";
import { assembleListing, type ListingFields } from "../listing";
import {
  parseContactName,
  parseDepositText,
  parseEnglishAvailability,
  parseEnglishEuro,
  parseEnglishNumber,
  parseEuroText,
  parseFloor,
  parseAvailability,
  parseNumberText,
} from "../parse";
import type { SiteAdapter } from "../types";

const EXPOSE_URL =
  /^https:\/\/www\.immobilienscout24\.de\/(?:en\/)?expose\/\d+/;
const ENGLISH_URL = /^https:\/\/www\.immobilienscout24\.de\/en\//;

/** The feature tags' site codes, which are the same in both languages. */
const GERMAN_FEATURES: Readonly<Record<string, Feature>> = {
  balcony: "Balkon",
  cellar: "Keller",
  flatShareSuitable: "WG-geeignet",
  handicappedAccessible: "Stufenloser Zugang",
  lift: "Personenaufzug",
};

function textOf(document: Document, selector: string): string | undefined {
  const text = document
    .querySelector(selector)
    ?.textContent.replace(/\s+/g, " ")
    .trim();
  return text === "" ? undefined : text;
}

/** The first selector that has text, so a moved block still reads. */
function firstText(
  document: Document,
  ...selectors: string[]
): string | undefined {
  for (const selector of selectors) {
    const text = textOf(document, selector);
    if (text !== undefined) return text;
  }
  return undefined;
}

function map<T, U>(value: T | undefined, f: (value: T) => U): U | undefined {
  return value === undefined ? undefined : f(value);
}

/**
 * `Musterweg 5, Reinickendorf (Ortsteil), 13401 Berlin`; the street is
 * left out when the landlord hides it. The district is the part before the
 * postcode, without its bracketed note.
 */
function districtOf(address: string): string | undefined {
  const parts = address.split(",").map((part) => part.trim());
  const postcodeIndex = parts.findIndex((part) => /^\d{5}\b/.test(part));
  const district = parts[postcodeIndex - 1];
  if (postcodeIndex < 1 || district === undefined) return undefined;
  if (/\d/.test(district)) return undefined;
  return district.replace(/\s*\(.*\)$/, "") || undefined;
}

function petPolicyOf(text: string): PetPolicy | undefined {
  if (/^(ja|yes)\b/i.test(text)) return "allowed";
  if (/^(nein|no)\b/i.test(text)) return "not_allowed";
  if (/vereinbarung|arrangement/i.test(text)) return "by_arrangement";
  return undefined;
}

/**
 * Neither probe page showed a WBS field, so this reads any criteria row
 * labelled Wohnberechtigungsschein or WBS by its label text rather than by
 * a class name nobody has seen.
 */
function wbsOf(document: Document): boolean | undefined {
  for (const label of document.querySelectorAll("dl dt")) {
    if (!/wohnberechtigungsschein|\bWBS\b/i.test(label.textContent)) continue;
    const value = label.nextElementSibling?.textContent.trim() ?? "";
    if (/nicht erforderlich|not required|^(nein|no)\b/i.test(value)) {
      return false;
    }
    if (/erforderlich|required|^(ja|yes)\b/i.test(value)) return true;
  }
  return undefined;
}

/** A criteria row found by its label, for one no probe page showed. */
function rowByLabel(document: Document, label: RegExp): string | undefined {
  for (const term of document.querySelectorAll("dl dt")) {
    if (!label.test(term.textContent)) continue;
    return term.nextElementSibling?.textContent.trim() || undefined;
  }
  return undefined;
}

/**
 * "von privat" in the private-offer logo (the sparse fixture) or
 * "Gewerblich" / "Commercial" in the verified box (the complete fixtures).
 */
function offeredByOf(document: Document): Listing["offeredBy"] {
  const privately = textOf(document, '[class*="private-offer-logo-content"]');
  if (privately !== undefined && /privat|private/i.test(privately)) {
    return "private";
  }
  const verified = textOf(document, ".verifiedBox");
  if (verified !== undefined && /gewerblich|commercial/i.test(verified)) {
    return "commercial";
  }
  return undefined;
}

/**
 * The "Preis- und Lageinformationen" block: "Preis der Immobilie im
 * Vergleich zu 500 Immobilien im Umkreis von 1000m." and the first legend
 * under the bar, the "Ø Angebotspreis" band. All four numbers or nothing;
 * the sparse fixture and the English page have an empty block.
 */
function priceComparisonOf(document: Document): PriceComparison | undefined {
  const intro = textOf(document, '[data-testid="quickcheck-intro"]');
  const sampleSize = map(/zu (\d+) /.exec(intro ?? "")?.[1], Number);
  const radiusM = map(/von (\d+) ?m\b/.exec(intro ?? "")?.[1], Number);
  // The band is the legend whose block is labelled "Ø Angebotspreis"; the
  // other legend holds the scale's ends, which are not the band.
  const legend = Array.from(
    document.querySelectorAll(
      '[data-testid="quickcheck-bar"] [data-testid="legend-item"]',
    ),
  ).find((item) =>
    Array.from(item.parentElement?.children ?? []).some(
      (sibling) =>
        sibling.tagName === "SPAN" && /Angebotspreis/.test(sibling.textContent),
    ),
  );
  const low = map(
    legend?.querySelector('[data-testid="left-value"]')?.textContent,
    parseEuroText,
  );
  const high = map(
    legend?.querySelector('[data-testid="right-value"]')?.textContent,
    parseEuroText,
  );
  if (
    sampleSize === undefined ||
    radiusM === undefined ||
    low === undefined ||
    high === undefined
  ) {
    return undefined;
  }
  return { lowCentsPerM2: low, highCentsPerM2: high, radiusM, sampleSize };
}

/**
 * The description block with the "Sonstiges" and condition rows and the
 * feature tags, scanned for what kind of rental it is. Nothing without the
 * description block: the kind is then unknown, not "nothing special".
 */
function hintsOf(
  document: Document,
  title: string | undefined,
): RentalHints | undefined {
  const description = textOf(document, ".expose-description-wrapper");
  if (description === undefined) return undefined;
  const tags = Array.from(
    document.querySelectorAll('#is24-boolean-criteria [data-qa$="-label"]'),
    (tag) => tag.textContent,
  );
  return rentalHints(
    [
      title,
      description,
      firstText(document, ".is24qa-sonstiges"),
      firstText(
        document,
        ".is24qa-objektzustand",
        ".is24qa-condition-of-the-property",
      ),
      ...tags,
    ].join("\n"),
  );
}

/** The feature tags under the key numbers: `Balkon/ Terrasse` → `Balkon`. */
function featuresOf(document: Document, english: boolean): Feature[] {
  const features: Feature[] = [];
  for (const tag of document.querySelectorAll(
    '#is24-boolean-criteria [data-qa$="-label"]',
  )) {
    // Letters stay German: an English tag goes by its code, or not at all.
    const code = /^is24qa-(.+)-label$/.exec(tag.getAttribute("data-qa") ?? "");
    const name = english
      ? GERMAN_FEATURES[code?.[1] ?? ""]
      : tag.textContent.split("/")[0]?.replace(/\s+/g, " ").trim();
    if (name && !features.includes(name)) features.push(name);
  }
  return features;
}

function readListing(document: Document, url: string): Listing | undefined {
  const english = ENGLISH_URL.test(url);
  const euro = english ? parseEnglishEuro : parseEuroText;
  const number = english ? parseEnglishNumber : parseNumberText;
  const availability = english ? parseEnglishAvailability : parseAvailability;
  const title = textOf(document, '[data-qa="expose-title"]');
  const kaltText = firstText(
    document,
    ".is24qa-kaltmiete",
    ".is24qa-net-rent",
    ".is24qa-maincriteria-baserent-label-main",
  );
  // An exposé always has a title and a rent block; a search page has
  // neither.
  if (title === undefined && kaltText === undefined) return undefined;
  const kaltmiete = map(kaltText, euro);

  const address = textOf(document, '[data-qa="is24-expose-address"]');
  const found: ListingFields = {
    title,
    address,
    district: map(address, districtOf),
    kaltmieteCents: kaltmiete,
    nebenkostenCents: map(
      firstText(document, ".is24qa-nebenkosten", ".is24qa-additional-costs"),
      euro,
    ),
    warmmieteCents: map(
      firstText(
        document,
        ".is24qa-gesamtmiete",
        ".is24qa-total-rent",
        ".is24qa-maincriteria-rentincludingutilities-label-main",
      ),
      euro,
    ),
    areaM2: map(
      firstText(
        document,
        ".is24qa-wohnflaeche-ca",
        ".is24qa-approx-living-area",
        ".is24qa-maincriteria-space-label-main",
      ),
      number,
    ),
    rooms: map(
      firstText(
        document,
        ".is24qa-zimmer",
        ".is24qa-rooms",
        ".is24qa-maincriteria-numberofrooms-label-main",
      ),
      number,
    ),
    floor: map(
      firstText(document, ".is24qa-etage", ".is24qa-floor"),
      parseFloor,
    ),
    availability: map(
      firstText(document, ".is24qa-bezugsfrei-ab", ".is24qa-available-from"),
      availability,
    ),
    // No probe page showed the year on `/en/`: the row keeps its label.
    yearBuilt: map(
      firstText(document, ".is24qa-baujahr") ??
        (english ? rowByLabel(document, /year/i) : undefined),
      parseNumberText,
    ),
    petPolicy: map(
      firstText(document, ".is24qa-haustiere", ".is24qa-pets"),
      petPolicyOf,
    ),
    wbsRequired: wbsOf(document),
    // A company is not named: the letter then greets "Damen und Herren".
    contactPerson: map(
      textOf(document, '[data-qa="contactName"]'),
      parseContactName,
    ),
    // The `/en/` page keeps the German class on the type row.
    flatType: firstText(document, ".is24qa-typ", ".is24qa-type"),
    // "Kaution o. Genossenschaftsanteile": the row keeps the German number
    // format on `/en/` too, and the sparse fixture reads a bare "1000".
    kautionCents: map(
      firstText(
        document,
        ".is24qa-kaution-o-genossenschaftsanteile",
        ".is24qa-deposit",
      ) ?? rowByLabel(document, /kaution|deposit/i),
      (text) => parseDepositText(text, kaltmiete),
    ),
    offeredBy: offeredByOf(document),
    priceComparison: priceComparisonOf(document),
    hints: hintsOf(document, title),
  };

  return assembleListing(url, featuresOf(document, english), found);
}

/**
 * The form in the dialog "Nachricht" opens. It is not in the page until
 * the user opens it; Kiezpigeon never opens it for them.
 */
function contactForm(document: Document): HTMLFormElement | undefined {
  return (
    document.querySelector<HTMLFormElement>(
      "[role='dialog'] form[data-testid='contact-form']",
    ) ?? undefined
  );
}

export const immoscout24: SiteAdapter = {
  id: "immoscout24",
  siteName: "ImmoScout24",
  matches: (url) => EXPOSE_URL.test(url),
  readListing,
  contactForm,
  readContactForm: (document) => {
    const form = contactForm(document);
    return form ? describeFields(form) : [];
  },
};
