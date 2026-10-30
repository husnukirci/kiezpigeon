// Why the panel's tab was not read as a listing (Phase 9), from its address
// and whether a site's content script answered. The address is unknown when
// the icon's `activeTab` grant has ended (ADR 8).
export type UnreadPage =
  "immoscout24_not_listing" | "reload_tab" | "other_site";

const IMMOSCOUT24 = /^https:\/\/www\.immobilienscout24\.de\//;
const EXPOSE = /^https:\/\/www\.immobilienscout24\.de\/(en\/)?expose\/\d+/;

export function unreadPage(
  url: string | undefined,
  scriptAnswered: boolean,
): UnreadPage {
  // ImmoScout24's is the only content script, so an answer names the site.
  if (scriptAnswered) return "immoscout24_not_listing";
  if (url === undefined || !IMMOSCOUT24.test(url)) return "other_site";
  return EXPOSE.test(url) ? "reload_tab" : "immoscout24_not_listing";
}
