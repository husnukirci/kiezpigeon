// What a known site's content script does (ADR 8): it reads the page only
// when the panel asks, calls nothing but its adapter and the fill layer, and
// fills only inside the open contact form, never sending it (ADR 11).
import type { SiteAdapter } from "../adapters/types";
import { fillPlanned } from "../fill/fill";
import { PAGE_ANSWERED } from "./fallback";
import { handle } from "./messaging";

/** How long a slow page may keep the panel waiting for its answer. */
export const READY_TIMEOUT_MS = 2000;

/** Waits for the adapter's page to be drawn, or for the time to run out. */
function untilReady(adapter: SiteAdapter): Promise<void> {
  const ready = (): boolean => adapter.isReady?.(document) ?? true;
  if (ready()) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (ready()) finish();
    });
    const timer = setTimeout(finish, READY_TIMEOUT_MS);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

export function answerAs(adapter: SiteAdapter): void {
  // So an injected fallback reader never answers beside this script.
  Object.assign(window, { [PAGE_ANSWERED]: true });
  handle({
    getListing: async () => {
      await untilReady(adapter);
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
