// The listing in the panel's tab (ADR 8). A panel opened from the icon
// belongs to one tab and asks only that tab: when it opens and whenever that
// tab finishes loading a page. Without a tab of its own (an older panel) it
// falls back to the active tab and follows tab switches. No answer means the
// page is not a listing.
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { send, type ListingResult } from "../../messaging/messaging";

export type ActiveListing = { kind: "loading" } | ListingResult;

const NOT_LISTING: ListingResult = { kind: "not_listing" };

async function askTab(ownTab: number | undefined): Promise<ListingResult> {
  try {
    const tabId =
      ownTab ??
      (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (tabId === undefined) return NOT_LISTING;
    return await send({ type: "getListing" }, tabId);
  } catch {
    // No content script on this page, or one from before an update.
    return NOT_LISTING;
  }
}

export function useActiveListing(ownTab?: number): ActiveListing {
  const [state, setState] = useState<ActiveListing>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    let latest = 0;
    const load = (): void => {
      const request = ++latest;
      void askTab(ownTab).then((result) => {
        // A slower answer for a tab the user already left is dropped.
        if (live && request === latest) setState(result);
      });
    };
    const onUpdated = (tabId: number, change: { status?: string }): void => {
      if (change.status !== "complete") return;
      if (ownTab === undefined || tabId === ownTab) load();
    };

    load();
    // A panel with its own tab never follows the user to another one.
    if (ownTab === undefined) browser.tabs.onActivated.addListener(load);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      live = false;
      browser.tabs.onActivated.removeListener(load);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [ownTab]);

  return state;
}
