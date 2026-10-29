// ImmoScout24 exposé pages (ADR 8). Reads the `is24qa-*` classes and
// `data-qa` attributes the site uses for its own tests, then parses the
// German text inside them. The page's tracking data and inline scripts are
// never read.
import type { FormField, Listing } from "../../rules/types";
import { parseContactName, parseEuroText, parseNumberText } from "../parse";
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
    contactPerson: map(
      textOf(document, '[data-qa="contactName"]'),
      parseContactName,
    ),
  };

  const listing: Listing = { url, features: [], missing: [] };
  for (const field of FIELDS) {
    const value = found[field];
    if (value === undefined) listing.missing.push(field);
    else Object.assign(listing, { [field]: value });
  }
  return listing;
}

export const immoscout24: SiteAdapter = {
  id: "immoscout24",
  siteName: "ImmoScout24",
  matches: (url) => EXPOSE_URL.test(url),
  readListing,
  // The contact form opens in a dialog after "Nachricht"; Phase 5 reads it.
  readContactForm: (): FormField[] => [],
};
