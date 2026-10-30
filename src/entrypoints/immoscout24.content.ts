import { defineContentScript } from "wxt/utils/define-content-script";
import { immoscout24 } from "../adapters/immoscout24/immoscout24";
import { fillPlanned } from "../fill/fill";
import { PAGE_ANSWERED } from "../messaging/fallback";
import { handle } from "../messaging/messaging";

// Answers the side panel on ImmoScout24 exposé pages (ADR 8). It reads the
// page only when asked, calls nothing but its adapter and the fill layer,
// and fills only inside the open contact form, never sending it (ADR 11).
export default defineContentScript({
  matches: ["https://www.immobilienscout24.de/expose/*"],
  main() {
    // So an injected fallback reader never answers beside this script.
    Object.assign(window, { [PAGE_ANSWERED]: true });
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
      getContactForm: () => {
        const fields = immoscout24.readContactForm(document);
        return fields.length > 0
          ? { kind: "form", fields }
          : { kind: "no_form" };
      },
      fillForm: (message) => {
        const form = immoscout24.contactForm(document);
        if (!form) return { kind: "no_form" };
        const report = fillPlanned(form, message.steps, message.formKeys);
        return report === "changed"
          ? { kind: "changed" }
          : { kind: "filled", report };
      },
    });
  },
});
