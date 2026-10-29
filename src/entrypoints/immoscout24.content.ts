import { defineContentScript } from "wxt/utils/define-content-script";
import { immoscout24 } from "../adapters/immoscout24/immoscout24";
import { handle } from "../messaging/messaging";

// Answers the side panel on ImmoScout24 exposé pages (ADR 8). It reads the
// page only when asked and calls nothing but its adapter.
export default defineContentScript({
  matches: ["https://www.immobilienscout24.de/expose/*"],
  main() {
    handle({
      ping: () => ({ type: "pong" }),
      getListing: () => {
        // Without the query string: it carries the site's tracking.
        const url = location.origin + location.pathname;
        const listing = immoscout24.readListing(document, url);
        return listing
          ? { kind: "listing", siteName: immoscout24.siteName, listing }
          : { kind: "not_listing" };
      },
    });
  },
});
