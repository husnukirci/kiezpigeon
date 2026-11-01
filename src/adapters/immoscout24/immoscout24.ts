// ImmoScout24 exposé pages (ADR 8). Reads the `is24qa-*` classes and
// `data-qa` attributes the site uses for its own tests, then parses the
// text inside them, German or, on the site's `/en/` address, English. The
// page's tracking data and inline scripts are never read.
import { describeFields } from "../../fill/describe";
import type { Feature, Listing, PetPolicy } from "../../rules/types";
import {
  parseContactName,
  parseEnglishAvailability,
  parseEnglishEuro,
  parseEnglishNumber,
  parseEuroText,
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

/** The fields readListing tries to fill, in the order it reports them. */
const FIELDS = [
  "title",
  "address",
  "district",
  "kaltmieteCents",
  "nebenkostenCents",
  "warmmieteCents",
  "areaM2",
  "rooms",
  "floor",
  "availability",
  "yearBuilt",
  "petPolicy",
  "wbsRequired",
  "contactPerson",
] as const satisfies readonly (keyof Listing)[];

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

/** `1 von 5` → 1, `EG` → 0, `UG` → -1; `3 of 5`, `Ground floor`, `Basement`. */
function floorOf(text: string): number | undefined {
  if (/^(EG|Erdgeschoss|Ground floor)\b/i.test(text)) return 0;
  if (/^(UG|Untergeschoss|Souterrain|Basement)\b/i.test(text)) return -1;
  const match = /^-?\d+/.exec(text);
  return match ? Number(match[0]) : undefined;
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

  const address = textOf(document, '[data-qa="is24-expose-address"]');
  const found: Pick<Listing, (typeof FIELDS)[number]> = {
    title,
    address,
    district: map(address, districtOf),
    kaltmieteCents: map(kaltText, euro),
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
    floor: map(firstText(document, ".is24qa-etage", ".is24qa-floor"), floorOf),
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
  };

  const listing: Listing = {
    url,
    features: featuresOf(document, english),
    missing: [],
  };
  for (const field of FIELDS) {
    const value = found[field];
    if (value === undefined) listing.missing.push(field);
    else Object.assign(listing, { [field]: value });
  }
  return listing;
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
