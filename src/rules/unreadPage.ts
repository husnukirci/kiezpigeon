// Why the panel's tab was not read as a listing (Phase 9), from its address
// and the site whose content script answered, if one did. The address is
// unknown when the icon's `activeTab` grant has ended (ADR 8).
export type UnreadPage =
  | { reason: "not_listing"; siteName: string }
  | { reason: "reload_tab" }
  | { reason: "other_site" };

/** The sites with an adapter, and the addresses their scripts answer on. */
const KNOWN_SITES = [
  {
    name: "ImmoScout24",
    site: /^https:\/\/www\.immobilienscout24\.de\//,
    listing: /^https:\/\/www\.immobilienscout24\.de\/(en\/)?expose\/\d+/,
  },
  {
    name: "Vonovia",
    site: /^https:\/\/www\.vonovia\.de\//,
    listing:
      /^https:\/\/www\.vonovia\.de\/zuhause-finden\/immobilien\/[^/?#]*\d+-\d+\/?(?:[?#]|$)/,
  },
];

export function unreadPage(
  url: string | undefined,
  answeredBy: string | undefined,
): UnreadPage {
  if (answeredBy !== undefined) {
    return { reason: "not_listing", siteName: answeredBy };
  }
  const known =
    url === undefined ? undefined : KNOWN_SITES.find((s) => s.site.test(url));
  if (url === undefined || known === undefined) return { reason: "other_site" };
  return known.listing.test(url)
    ? { reason: "reload_tab" }
    : { reason: "not_listing", siteName: known.name };
}
