import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";
import { generic } from "../adapters/generic/generic";
import { fillForm } from "../fill/fill";
import { PAGE_ANSWERED } from "../messaging/fallback";
import { handle } from "../messaging/messaging";

// The reader for sites without an adapter (ADR 12). The panel injects it
// into its tab on the user's click, under the icon click's `activeTab`
// grant; it is never in a page by itself. It answers the same form messages
// as a site's content script, inside the form `generic` picks, and fills
// without ever sending (ADR 11). Returns the page's address for the listing.
export default defineUnlistedScript(() => {
  // Injected again before each read, and possibly into a page whose site
  // content script already answers: either way the page answers once.
  if (!(PAGE_ANSWERED in window)) {
    Object.assign(window, { [PAGE_ANSWERED]: true });
    handle({
      getContactForm: () => {
        const fields = generic.readContactForm(document);
        return fields.length > 0
          ? { kind: "form", fields }
          : { kind: "no_form" };
      },
      fillForm: (message) => {
        const form = generic.contactForm(document);
        return form
          ? { kind: "filled", report: fillForm(form, message.steps) }
          : { kind: "no_form" };
      },
    });
  }
  // Without the query string, which often carries tracking.
  return location.origin + location.pathname;
});
