// Vonovia listing pages. The site has no test attributes, so this reads the
// visible rows and key figures by their German labels, then parses the text
// beside them. The JSON the page also carries is never read (ADR 8).
import { describeFields } from "../../fill/describe";
import type { Feature, Listing } from "../../rules/types";
import { assembleListing } from "../listing";
import {
  parseAvailability,
  parseContactName,
  parseEuroText,
  parseNumberText,
} from "../parse";
import type { SiteAdapter } from "../types";

// A slug that ends in the object id: `helle-wohnung-82-1000000001`.
const LISTING_URL =
  /^https:\/\/www\.vonovia\.de\/zuhause-finden\/immobilien\/[^/?#]*\d+-\d+\/?(?:[?#]|$)/;

function clean(text: string | null | undefined): string | undefined {
  return text?.replace(/\s+/g, " ").trim() || undefined;
}

function textOf(document: Document, selector: string): string | undefined {
  return clean(document.querySelector(selector)?.textContent);
}

/** `Geschoss` beside `2. Obergeschoß`, in the page's detail lists. */
function row(document: Document, label: string): string | undefined {
  for (const name of document.querySelectorAll("li > .name")) {
    if (clean(name.textContent) !== label) continue;
    return clean(name.nextElementSibling?.textContent);
  }
  return undefined;
}

/** `Zimmer` under `3`, in the key figures above the lists. */
function figure(document: Document, label: string): string | undefined {
  for (const subline of document.querySelectorAll(".headlines > .subline")) {
    if (clean(subline.textContent) !== label) continue;
    return clean(subline.previousElementSibling?.textContent);
  }
  return undefined;
}

function map<T, U>(value: T | undefined, f: (value: T) => U): U | undefined {
  return value === undefined ? undefined : f(value);
}

/** `Musterstr. 12 - 10999 Berlin OT Kreuzberg`, the street sometimes left out. */
function addressOf(document: Document): string | undefined {
  return textOf(document, "a.attachments > span");
}

function districtOf(address: string): string | undefined {
  return /\bOT\s+(.+)$/.exec(address)?.[1];
}

/** `2. Obergeschoß` → 2, `Erdgeschoss` → 0, `Souterrain` → -1. */
function floorOf(text: string): number | undefined {
  if (/^(EG|Erdgescho(ss|ß))\b/i.test(text)) return 0;
  if (/^(UG|Untergescho(ss|ß)|Souterrain)\b/i.test(text)) return -1;
  const match = /^(\d+)\.?\s*(OG|Obergescho(ss|ß))?/i.exec(text);
  return match ? Number(match[1]) : undefined;
}

function featuresOf(document: Document): Feature[] {
  const features: Feature[] = [];
  for (const badge of document.querySelectorAll(".equipment-list .badge")) {
    const name = clean(badge.textContent);
    if (name && !features.includes(name)) features.push(name);
  }
  return features;
}

function kaltText(document: Document): string | undefined {
  return row(document, "Kaltmiete") ?? figure(document, "Kaltmiete");
}

/**
 * The rows and key figures are in the page as it arrives. The site's script
 * draws the title and the address together, just after the load event.
 */
function isReady(document: Document): boolean {
  return (
    kaltText(document) === undefined || textOf(document, "h1") !== undefined
  );
}

function readListing(document: Document, url: string): Listing | undefined {
  const kalt = kaltText(document);
  // A for-sale object has a price instead, and a search page has neither.
  if (kalt === undefined) return undefined;

  const address = addressOf(document);
  return assembleListing(url, featuresOf(document), {
    title: textOf(document, "h1"),
    address,
    district: map(address, districtOf),
    kaltmieteCents: parseEuroText(kalt),
    nebenkostenCents: map(row(document, "Nebenkosten"), parseEuroText),
    warmmieteCents: map(
      row(document, "Warmmiete") ?? figure(document, "Warmmiete"),
      parseEuroText,
    ),
    areaM2: map(figure(document, "Größe"), parseNumberText),
    rooms: map(figure(document, "Zimmer"), parseNumberText),
    floor: map(row(document, "Geschoss"), floorOf),
    availability: map(
      row(document, "Verfügbar ab") ?? figure(document, "Bezugsfrei ab"),
      parseAvailability,
    ),
    yearBuilt: map(row(document, "Baujahr"), parseNumberText),
    // A company is not named: the letter then greets "Damen und Herren".
    contactPerson: map(
      textOf(document, ".teaser-m-person .headline"),
      parseContactName,
    ),
  });
}

/**
 * The form is in the page from the start, inside an overlay "Anfrage
 * senden" opens by adding `active`. Kiezpigeon never opens it for the user.
 */
function contactForm(document: Document): HTMLFormElement | undefined {
  return (
    document.querySelector<HTMLFormElement>(
      ".overlay-contact-form.active form[name='real-estate-contact-form']",
    ) ?? undefined
  );
}

export const vonovia: SiteAdapter = {
  id: "vonovia",
  siteName: "Vonovia",
  matches: (url) => LISTING_URL.test(url),
  isReady,
  readListing,
  contactForm,
  readContactForm: (document) => {
    const form = contactForm(document);
    return form ? describeFields(form) : [];
  },
};
