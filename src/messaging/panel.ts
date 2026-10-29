// The side panel belongs to the tab it was opened on (ADR 8): the icon
// click switches it on for that tab only, and its path names the tab, so
// the panel reads that tab's listing and never follows the user elsewhere.
import { browser } from "wxt/browser";

const PANEL_PAGE = "sidepanel.html";

export function panelPathFor(tabId: number): string {
  return `${PANEL_PAGE}?tabId=${tabId}`;
}

/** The tab named in the panel's own query string, if it names a real one. */
export function panelTabId(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("tabId");
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
}

/**
 * For the icon click. Both calls run in the click's own turn, unawaited:
 * `sidePanel.open` is only allowed in response to the user's gesture.
 */
export function openPanelOn(tab: { id?: number }): void {
  if (tab.id === undefined) return;
  void browser.sidePanel.setOptions({
    tabId: tab.id,
    path: panelPathFor(tab.id),
    enabled: true,
  });
  void browser.sidePanel.open({ tabId: tab.id });
}
