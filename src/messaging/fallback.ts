// Puts the fallback reader into the panel's tab (ADR 12): only on the
// user's click, and only while the `activeTab` grant from the icon click
// holds. No host permission is involved, so without the grant it fails.
import { browser } from "wxt/browser";

/** Where WXT writes the `fallback` unlisted script in the build. */
export const FALLBACK_SCRIPT = "/fallback.js";

/**
 * Injects the reader (a no-op answer if it is already there) and resolves
 * with the page's address. Rejects when Kiezpigeon may not read the tab:
 * no grant, a browser page, or the tab is gone.
 */
export async function injectFallback(tabId: number): Promise<string> {
  const [frame] = await browser.scripting.executeScript({
    target: { tabId },
    files: [FALLBACK_SCRIPT],
  });
  const address: unknown = frame?.result;
  if (typeof address !== "string") {
    throw new Error("The page did not answer the fallback reader");
  }
  return address;
}
