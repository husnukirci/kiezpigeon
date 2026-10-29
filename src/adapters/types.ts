// The adapter interface (ADR 8): one adapter per site, a page's DOM in,
// plain data out. Adapters never throw on a missing field; they leave it
// out of the Listing and name it in `missing`.
import type { FormField, Listing } from "../rules/types";

export interface SiteAdapter {
  /** Stable id used in messages, e.g. `immoscout24`. */
  id: string;
  /** Shown in the detected badge, e.g. `ImmoScout24`. */
  siteName: string;
  matches(url: string): boolean;
  /** `undefined` when the page is not a listing. */
  readListing(document: Document, url: string): Listing | undefined;
  /** The open contact form, the root that filling works inside. */
  contactForm(document: Document): HTMLFormElement | undefined;
  /** Its fields as plain data; empty while no form is open. */
  readContactForm(document: Document): FormField[];
}
