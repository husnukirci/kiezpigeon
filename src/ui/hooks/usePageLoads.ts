// Counts the pages the panel's tab has finished loading since the panel
// opened (ADR 12). What the user typed or chose for one page on an unknown
// site belongs to that page, so the panel starts over when this changes.
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

export function usePageLoads(ownTab: number | undefined): number {
  const [loads, setLoads] = useState(0);

  useEffect(() => {
    const bump = (): void => {
      setLoads((n) => n + 1);
    };
    const onUpdated = (tabId: number, change: { status?: string }): void => {
      if (change.status !== "complete") return;
      if (ownTab === undefined || tabId === ownTab) bump();
    };
    browser.tabs.onUpdated.addListener(onUpdated);
    // A panel without a tab of its own follows the active one.
    if (ownTab === undefined) browser.tabs.onActivated.addListener(bump);
    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onActivated.removeListener(bump);
    };
  }, [ownTab]);

  return loads;
}
