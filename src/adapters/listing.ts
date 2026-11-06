// Puts what an adapter read into a Listing: a field that was found goes on
// it, and one that was not is named in `missing` (ADR 8).
import type { Feature, Listing } from "../rules/types";

/** The fields an adapter tries to fill, in the order it reports them. */
export const LISTING_FIELDS = [
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
  "flatType",
  "kautionCents",
  "offeredBy",
  "priceComparison",
  "hints",
] as const satisfies readonly (keyof Listing)[];

export type ListingFields = Partial<
  Pick<Listing, (typeof LISTING_FIELDS)[number]>
>;

export function assembleListing(
  url: string,
  features: Feature[],
  found: ListingFields,
): Listing {
  const listing: Listing = { url, features, missing: [] };
  for (const field of LISTING_FIELDS) {
    const value = found[field];
    if (value === undefined) listing.missing.push(field);
    else Object.assign(listing, { [field]: value });
  }
  return listing;
}
