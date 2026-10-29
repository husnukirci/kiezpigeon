// The listing in the tab the user is looking at (ADR 8). Asks the tab's
// content script when the panel opens, when the user switches tabs and
// when a tab finishes loading. No answer means the page is not a listing.
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { send, type ListingResult } from "../../messaging/messaging";

export type ActiveListing = { kind: "loading" } | ListingResult;

const NOT_LISTING: ListingResult = { kind: "not_listing" };

async function askActiveTab(): Promise<ListingResult> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) return NOT_LISTING;
    return await send({ type: "getListing" }, tab.id);
  } catch {
    // No content script on this page, or one from before an update.
    return NOT_LISTING;
  }
}

export function useActiveListing(): ActiveListing {
  const [state, setState] = useState<ActiveListing>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    let latest = 0;
    const load = (): void => {
      const request = ++latest;
      void askActiveTab().then((result) => {
        // A slower answer for a tab the user already left is dropped.
        if (live && request === latest) setState(result);
      });
    };
    const onUpdated = (_tabId: number, change: { status?: string }): void => {
      if (change.status === "complete") load();
    };

    load();
    browser.tabs.onActivated.addListener(load);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      live = false;
      browser.tabs.onActivated.removeListener(load);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return state;
}
