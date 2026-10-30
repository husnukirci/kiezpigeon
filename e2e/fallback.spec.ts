// The fallback for unknown sites (ADR 12) in the built extension: an
// invented page served at an address no adapter knows, the panel page
// opened by its URL, and the icon click stood in for by CDP
// `Extensions.triggerAction`, which grants `activeTab` like a real click.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { browser } from "wxt/browser";

// Inside extension pages, where `evaluate` runs, `chrome` is the API that
// WXT wraps as `browser`.
declare const chrome: typeof browser;

const ROOT = join(import.meta.dirname, "..");
const EXTENSION = join(ROOT, ".output", "chrome-mv3");
const SITE = "https://flats.example/wohnung/17";
const FIXTURE = readFileSync(
  join(ROOT, "fixtures", "generic", "contact-form.html"),
  "utf8",
);

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  await context.route(`${SITE}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: FIXTURE }),
  );
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close();
});

/** The icon click on the site's tab, which must be in front for it. */
async function clickIcon(site: Page): Promise<void> {
  await site.bringToFront();
  // The Extensions domain answers only a browser-level session.
  const cdp = await context.browser()?.newBrowserCDPSession();
  if (!cdp) throw new Error("no browser CDP session");
  const { targetInfos } = await cdp.send("Target.getTargets", {
    filter: [{ type: "tab" }],
  });
  const tab = targetInfos.find((target) => target.url === site.url());
  if (!tab) throw new Error("no tab target for the site");
  await cdp.send("Extensions.triggerAction", {
    id: extensionId,
    targetId: tab.targetId,
  });
}

async function siteTabId(): Promise<number | undefined> {
  const worker = context.serviceWorkers()[0];
  return worker?.evaluate(
    async () => (await chrome.tabs.query({ active: true }))[0]?.id,
  );
}

test("the reader goes into an unknown site only after the icon click", async () => {
  const site = context.pages()[0] ?? (await context.newPage());
  await site.goto(SITE);
  await site.bringToFront();
  const tabId = await siteTabId();
  expect(tabId).toBeDefined();

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const inject = (id: number | undefined) =>
    panel.evaluate(async (tab) => {
      try {
        const [frame] = await chrome.scripting.executeScript({
          target: { tabId: tab ?? -1 },
          files: ["/fallback.js"],
        });
        return { ok: true, result: frame?.result };
      } catch (error) {
        return { ok: false, result: String(error) };
      }
    }, id);

  // No host permission: before the click the page is out of reach.
  expect(await inject(tabId)).toMatchObject({ ok: false });

  await clickIcon(site);
  expect(await inject(tabId)).toEqual({ ok: true, result: SITE });
  // Injected twice, it still answers once and reads the enquiry form.
  expect(await inject(tabId)).toEqual({ ok: true, result: SITE });
  const answer: unknown = await panel.evaluate(
    (tab) => chrome.tabs.sendMessage(tab ?? -1, { type: "getContactForm" }),
    tabId,
  );
  expect(answer).toMatchObject({ ok: true, value: { kind: "form" } });
  const names = (
    answer as { value: { fields: { name?: string }[] } }
  ).value.fields.map((field) => field.name);
  expect(names).toContain("nachricht");
  expect(names).not.toContain("q");
});
