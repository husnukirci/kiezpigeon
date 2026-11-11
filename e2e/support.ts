// What the specs share: the built extension, a Chromium that has loaded it,
// the panel page opened by its URL, and the recorder of send attempts.
// Assertions stay in the specs.
import { join } from "node:path";
import {
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import type { browser } from "wxt/browser";

// Inside the extension's service worker, where `worker.evaluate` runs,
// `chrome` is the API that WXT wraps as `browser`.
declare const chrome: typeof browser;

const EXTENSION = join(import.meta.dirname, "..", ".output", "chrome-mv3");

/**
 * Chromium with the built extension loaded, on a profile directory of its
 * own when `profileDir` is given and a throwaway one otherwise.
 */
export async function launchExtension(profileDir = ""): Promise<{
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
}> {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  await worker.evaluate(() => chrome.storage.local.get(null));
  return { context, extensionId: new URL(worker.url()).host, worker };
}

/**
 * The side panel page opened in a tab of its own, for the tab `tabId` (the
 * active one when left out), at `viewport` when given.
 */
export async function openPanel(
  context: BrowserContext,
  extensionId: string,
  options: {
    tabId?: number;
    viewport?: { width: number; height: number };
  } = {},
): Promise<Page> {
  const panel = await context.newPage();
  if (options.viewport) await panel.setViewportSize(options.viewport);
  const query = options.tabId === undefined ? "" : `?tabId=${options.tabId}`;
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html${query}`);
  return panel;
}

/** Runs in the page before its own markup: records any attempt to send. */
export function recordSendAttempts(): void {
  const record: string[] = [];
  Object.assign(window, { sendAttempts: record });
  for (const type of [
    "submit",
    "reset",
    "click",
    "keydown",
    "keyup",
    "keypress",
    "focusin",
  ]) {
    document.addEventListener(type, () => record.push(type), true);
  }
}
