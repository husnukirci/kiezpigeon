// What a known site's content script does (ADR 8): it reads the page only
// when the panel asks, calls nothing but its adapter and the fill layer, and
// fills only inside the open contact form, never sending it (ADR 11).
import type { SiteAdapter } from "../adapters/types";
import { fillPlanned } from "../fill/fill";
import { PAGE_ANSWERED } from "./fallback";
import { handle } from "./messaging";

export function answerAs(adapter: SiteAdapter): void {
  // So an injected fallback reader never answers beside this script.
  Object.assign(window, { [PAGE_ANSWERED]: true });
  handle({
    ping: () => ({ type: "pong" }),
    getListing: () => {
      // Without the query string: it carries the site's tracking.
      const url = location.origin + location.pathname;
      const listing = adapter.readListing(document, url);
      return listing
        ? { kind: "listing", siteName: adapter.siteName, listing }
        : { kind: "not_listing", siteName: adapter.siteName };
    },
    getContactForm: () => {
      const fields = adapter.readContactForm(document);
      return fields.length > 0 ? { kind: "form", fields } : { kind: "no_form" };
    },
    fillForm: (message) => {
      const form = adapter.contactForm(document);
      if (!form) return { kind: "no_form" };
      const report = fillPlanned(form, message.steps, message.formKeys);
      return report === "changed"
        ? { kind: "changed" }
        : { kind: "filled", report };
    },
  });
}
