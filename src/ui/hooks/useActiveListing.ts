// The listing in the panel's tab (ADR 8). A panel opened from the icon
// belongs to one tab and asks only that tab: when it opens and whenever that
// tab finishes loading a page. Without a tab of its own (an older panel) it
// falls back to the active tab and follows tab switches. A tab that is not a
// listing also says why, from its address and the script's answer.
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { send, type ListingResult } from "../../messaging/messaging";
import { unreadPage, type UnreadPage } from "../../rules/unreadPage";

export type ActiveListing =
  | { kind: "loading" }
  | Extract<ListingResult, { kind: "listing" }>
  | { kind: "not_read"; page: UnreadPage };

/** The panel's own tab, or the active one for a panel without a tab. */
export async function panelTab(
  ownTab: number | undefined,
): Promise<number | undefined> {
  return (
    ownTab ??
    (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id
  );
}

/** Set only under the icon click's `activeTab` grant (ADR 8). */
async function tabUrl(tabId: number): Promise<string | undefined> {
  try {
    return (await browser.tabs.get(tabId)).url;
  } catch {
    return undefined;
  }
}

async function askTab(
  ownTab: number | undefined,
): Promise<Exclude<ActiveListing, { kind: "loading" }>> {
  let tabId: number | undefined;
  try {
    tabId = await panelTab(ownTab);
    if (tabId === undefined) throw new Error("No tab");
    const answer = await send({ type: "getListing" }, tabId);
    if (answer.kind === "listing") return answer;
    return { kind: "not_read", page: unreadPage(await tabUrl(tabId), true) };
  } catch {
    // No content script on this page, or one from before an update.
    const url = tabId === undefined ? undefined : await tabUrl(tabId);
    return { kind: "not_read", page: unreadPage(url, false) };
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
