// The platform Vonovia and Deutsche Wohnen share. It has no test attributes,
// so this reads the visible rows and key figures by their German labels, then
// parses the text beside them. The JSON the page also carries is never read
// (ADR 8). A site differs only by its id, its name and its listing address.
import { describeFields } from "../fill/describe";
import type { Feature, Listing, RentalHints } from "../rules/types";
import { rentalHints } from "../rules/rentalHints";
import { assembleListing } from "./listing";
import {
  parseAvailability,
  parseContactName,
  parseDepositText,
  parseEuroText,
  parseFloor,
  parseNumberText,
} from "./parse";
import type { SiteAdapter } from "./types";

/** What tells one site on the platform from another. */
export interface EstatePlatformSite {
  id: string;
  siteName: string;
  listingUrl: RegExp;
}

/** The listing's name: an `h1` on one site, an `h2` in the hero on another. */
const TITLE = "h1, .real-estate-hero .headlines > .headline";

/** The `Typ` rows a person can apply to live in. */
const HOME_TYPES = new Set(["Wohnung", "Haus"]);

function clean(text: string | null | undefined): string | undefined {
  return text?.replace(/\s+/g, " ").trim() || undefined;
}

function textOf(document: Document, selector: string): string | undefined {
  return clean(document.querySelector(selector)?.textContent);
}

function titleOf(document: Document): string | undefined {
  const title = textOf(document, TITLE);
  // What the site prints for a listing whose landlord gave it no name.
  return title === "Kein Titel" ? undefined : title;
}

/** `Geschoss` beside `2. Obergeschoß`, in the page's detail lists. */
function row(document: Document, label: string): string | undefined {
  for (const name of document.querySelectorAll("li > .name")) {
    if (clean(name.textContent) !== label) continue;
    return clean(name.nextElementSibling?.textContent);
  }
  return undefined;
}

/**
 * The text of the content card headed `label` (`Beschreibung`, `Sonstige
 * Angaben`): the `.rte` block next to its headline.
 */
function cardText(document: Document, label: string): string | undefined {
  for (const headline of document.querySelectorAll("h2.headline")) {
    if (clean(headline.textContent) !== label) continue;
    const card = headline.closest(".content");
    return clean(card?.querySelector(".rte")?.textContent);
  }
  return undefined;
}

/** Nothing without the Beschreibung card: the kind is then unknown. */
function hintsOf(document: Document): RentalHints | undefined {
  const description = cardText(document, "Beschreibung");
  if (description === undefined) return undefined;
  return rentalHints(
    [
      titleOf(document),
      description,
      cardText(document, "Sonstige Angaben"),
    ].join("\n"),
  );
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
 * The frame of a listing page is in the page as it arrives, and a search page
 * does not have one. The site's script draws the title and the address
 * together just after the load event, and the rows may come later still.
 */
function isReady(document: Document): boolean {
  if (document.querySelector(".estate-detail-page") === null) return true;
  return (
    textOf(document, TITLE) !== undefined &&
    document.querySelector("li > .name") !== null
  );
}

function readListing(document: Document, url: string): Listing | undefined {
  const kalt = kaltText(document);
  // A for-sale object has a price instead, and a search page has neither.
  if (kalt === undefined) return undefined;
  // The site lists parking spaces and shops the same way, with a Kaltmiete.
  const type = row(document, "Typ");
  if (type !== undefined && !HOME_TYPES.has(type)) return undefined;

  const address = addressOf(document);
  const kaltmiete = parseEuroText(kalt);
  return assembleListing(url, featuresOf(document), {
    title: titleOf(document),
    address,
    district: map(address, districtOf),
    kaltmieteCents: kaltmiete,
    nebenkostenCents: map(row(document, "Nebenkosten"), parseEuroText),
    warmmieteCents: map(
      row(document, "Warmmiete") ?? figure(document, "Warmmiete"),
      parseEuroText,
    ),
    areaM2: map(figure(document, "Größe"), parseNumberText),
    rooms: map(figure(document, "Zimmer"), parseNumberText),
    floor: map(row(document, "Geschoss"), parseFloor),
    availability: map(
      row(document, "Verfügbar ab") ??
        figure(document, "Bezugsfrei ab") ??
        figure(document, "Verfügbarkeit"),
      parseAvailability,
    ),
    yearBuilt: map(row(document, "Baujahr"), parseNumberText),
    // A company is not named: the letter then greets "Damen und Herren".
    contactPerson: map(
      textOf(document, ".teaser-m-person .headline"),
      parseContactName,
    ),
    flatType: row(document, "Art"),
    kautionCents: map(row(document, "Kaution"), (text) =>
      parseDepositText(text, kaltmiete),
    ),
    // The platform prints no offerer marker and no price comparison.
    hints: hintsOf(document),
  });
}

/**
 * The form sits inside an overlay "Anfrage senden" opens by adding `active`.
 * The site's script draws the overlay, sometimes twice, and only the one the
 * user opened is active. Kiezpigeon never opens it for the user.
 */
function contactForm(document: Document): HTMLFormElement | undefined {
  return (
    document.querySelector<HTMLFormElement>(
      ".overlay-contact-form.active form[name='real-estate-contact-form']",
    ) ?? undefined
  );
}

export function estatePlatformAdapter(site: EstatePlatformSite): SiteAdapter {
  return {
    id: site.id,
    siteName: site.siteName,
    matches: (url) => site.listingUrl.test(url),
    isReady,
    readListing,
    contactForm,
    readContactForm: (document) => {
      const form = contactForm(document);
      return form ? describeFields(form) : [];
    },
  };
}
