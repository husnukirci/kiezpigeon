// ImmoScout24 exposé pages (ADR 8). Reads the `is24qa-*` classes and
// `data-qa` attributes the site uses for its own tests, then parses the
// German text inside them. The page's tracking data and inline scripts are
// never read.
import { describeFields } from "../../fill/describe";
import type { Feature, Listing, PetPolicy } from "../../rules/types";
import {
  parseContactName,
  parseEuroText,
  parseAvailability,
  parseNumberText,
} from "../parse";
import type { SiteAdapter } from "../types";

const EXPOSE_URL = /^https:\/\/www\.immobilienscout24\.de\/expose\/\d+/;

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

/** `1 von 5` → 1, `EG` → 0, `UG` → -1. */
function floorOf(text: string): number | undefined {
  if (/^(EG|Erdgeschoss)\b/i.test(text)) return 0;
  if (/^(UG|Untergeschoss|Souterrain)\b/i.test(text)) return -1;
  const match = /^-?\d+/.exec(text);
  return match ? Number(match[0]) : undefined;
}

function petPolicyOf(text: string): PetPolicy | undefined {
  if (/^ja\b/i.test(text)) return "allowed";
  if (/^nein\b/i.test(text)) return "not_allowed";
  if (/vereinbarung/i.test(text)) return "by_arrangement";
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
    if (/nicht erforderlich|^nein\b/i.test(value)) return false;
    if (/erforderlich|^ja\b/i.test(value)) return true;
  }
  return undefined;
}

/** The feature tags under the key numbers: `Balkon/ Terrasse` → `Balkon`. */
function featuresOf(document: Document): Feature[] {
  const features: Feature[] = [];
  for (const tag of document.querySelectorAll(
    '#is24-boolean-criteria [data-qa$="-label"]',
  )) {
    const name = tag.textContent.split("/")[0]?.replace(/\s+/g, " ").trim();
    if (name && !features.includes(name)) features.push(name);
  }
  return features;
}

function readListing(document: Document, url: string): Listing | undefined {
  const title = textOf(document, '[data-qa="expose-title"]');
  const kaltText = firstText(
    document,
    ".is24qa-kaltmiete",
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
    kaltmieteCents: map(kaltText, parseEuroText),
    nebenkostenCents: map(
      textOf(document, ".is24qa-nebenkosten"),
      parseEuroText,
    ),
    warmmieteCents: map(
      firstText(
        document,
        ".is24qa-gesamtmiete",
        ".is24qa-maincriteria-rentincludingutilities-label-main",
      ),
      parseEuroText,
    ),
    areaM2: map(
      firstText(
        document,
        ".is24qa-wohnflaeche-ca",
        ".is24qa-maincriteria-space-label-main",
      ),
      parseNumberText,
    ),
    rooms: map(
      firstText(
        document,
        ".is24qa-zimmer",
        ".is24qa-maincriteria-numberofrooms-label-main",
      ),
      parseNumberText,
    ),
    floor: map(textOf(document, ".is24qa-etage"), floorOf),
    availability: map(
      textOf(document, ".is24qa-bezugsfrei-ab"),
      parseAvailability,
    ),
    yearBuilt: map(textOf(document, ".is24qa-baujahr"), parseNumberText),
    petPolicy: map(textOf(document, ".is24qa-haustiere"), petPolicyOf),
    wbsRequired: wbsOf(document),
    // A company is not named: the letter then greets "Damen und Herren".
    contactPerson: map(
      textOf(document, '[data-qa="contactName"]'),
      parseContactName,
    ),
  };

  const listing: Listing = {
    url,
    features: featuresOf(document),
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
