// The fallback for unknown sites (ADR 12) in the built extension: invented
// pages served at an address no adapter knows, the panel page opened by its
// URL, and the icon click stood in for by CDP `Extensions.triggerAction`,
// which grants `activeTab` like a real click. Claude is answered locally.
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
import { passingLetter } from "../test-support/sample-letters";
import { coupleWithDog } from "../test-support/sample-profiles";

// Inside extension pages, where `evaluate` runs, `chrome` is the API that
// WXT wraps as `browser`.
declare const chrome: typeof browser;

const ROOT = join(import.meta.dirname, "..");
const EXTENSION = join(ROOT, ".output", "chrome-mv3");
const ORIGIN = "https://flats.example";
const SITE = `${ORIGIN}/wohnung/17`;
const PAGES: Record<string, string> = {
  "/wohnung/17": "contact-form.html",
  "/wohnung/18": "contact-form-placeholders.html",
};

/** Runs in the page before its own markup: records any attempt to send. */
function recordSendAttempts(): void {
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

let context: BrowserContext;
let extensionId: string;
let pageLoads: string[];

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  pageLoads = [];
  // Any address on the site loads a fixture, so a sent form shows up as a
  // second load (GET or POST) instead of a network error.
  await context.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    pageLoads.push(`${route.request().method()} ${url.pathname}`);
    const file = PAGES[url.pathname] ?? "contact-form.html";
    return route.fulfill({
      contentType: "text/html",
      body: readFileSync(join(ROOT, "fixtures", "generic", file), "utf8"),
    });
  });
  await context.route("https://api.anthropic.com/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_e2e",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: passingLetter }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    }),
  );
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  extensionId = new URL(worker.url()).host;
  await worker.evaluate(
    (profile) =>
      chrome.storage.local.set({
        schemaVersion: 2,
        profile,
        apiKey: "e2e-placeholder-not-a-key",
      }),
    coupleWithDog,
  );
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

interface Case {
  path: string;
  /** The preview's pairs, in page order. */
  pairs: (string | RegExp)[];
  /** Field values on the page after the fill, by name. */
  filled: Record<string, string>;
  /** Left empty: unmatched, opted out, or a hidden spam trap. */
  untouched: string[];
  consent: string;
}

const CASES: Case[] = [
  {
    path: "/wohnung/17",
    pairs: [
      "Vorname → Mara",
      "Nachname → Testmann",
      "E-Mail → mara.testmann@example.org",
      "Telefon → 030 5550123",
      /^Ihre Nachricht → your letter \(\d+ words\)$/,
    ],
    filled: {
      vorname: "Mara",
      nachname: "Testmann",
      telefon: "030 5550123",
    },
    untouched: ["anrede", "email"],
    consent: "datenschutz",
  },
  {
    path: "/wohnung/18",
    pairs: [
      "Vorname → Mara",
      "Nachname → Testmann",
      "Straße und Hausnummer → Erfundene Straße 7",
      "PLZ / Ort → 10999 Berlin",
      "E-Mail-Adresse → mara.testmann@example.org",
      "Anzahl Erwachsene → 2",
      "Gewünschter Einzug → 01.03.2027",
      "Ich habe Haustiere → ticked",
      /^Nachricht an uns → your letter \(\d+ words\)$/,
    ],
    filled: {
      fname: "Mara",
      strasse: "Erfundene Straße 7",
      plzort: "10999 Berlin",
      einzug: "2027-03-01",
    },
    untouched: ["mail", "email_repeat"],
    consent: "agb",
  },
];

for (const page of CASES) {
  test(`on ${page.path} the pairs are confirmed, one is left out, nothing is sent`, async () => {
    pageLoads.length = 0;
    const site = await context.newPage();
    await site.addInitScript(recordSendAttempts);
    await site.goto(`${ORIGIN}${page.path}`);
    await clickIcon(site);
    const tabId = await siteTabId();

    const panel = await context.newPage();
    await panel.goto(
      `chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`,
    );
    await panel.getByRole("button", { name: "Use this page" }).click();
    await panel.getByLabel("Kaltmiete in €").fill("980");
    await panel.getByLabel("Features, separated by commas").fill("Balkon");
    await panel.getByRole("button", { name: "Continue" }).click();
    await expect(
      panel.getByText("Your listing facts · flats.example"),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Write my letter" }).click();

    const pairs = panel.getByRole("button", { name: /→/ });
    await expect(pairs).toHaveText(page.pairs);
    // Opting out of the email: it stays empty on the page.
    await panel.getByRole("button", { name: /^E-Mail/ }).click();
    await expect(
      panel.getByRole("button", { name: /^E-Mail/ }),
    ).toHaveAttribute("aria-pressed", "false");

    await panel.getByRole("button", { name: "Fill the form" }).click();
    await expect(
      panel.getByText(`Filled ${page.pairs.length - 1} fields.`, {
        exact: false,
      }),
    ).toBeVisible();

    // Nothing was sent: one load of the page, no submit, click or key event.
    await site.waitForLoadState("networkidle");
    expect(pageLoads).toEqual([`GET ${page.path}`]);
    expect(
      await site.evaluate(
        () => (window as unknown as { sendAttempts: string[] }).sendAttempts,
      ),
    ).toEqual([]);

    const form = (name: string) => site.locator(`[name="${name}"]`);
    for (const [name, value] of Object.entries(page.filled)) {
      await expect(form(name)).toHaveValue(value);
    }
    for (const name of page.untouched) {
      await expect(form(name)).toHaveValue("");
    }
    await expect(form(page.consent)).not.toBeChecked();
    await expect(site.locator("textarea")).not.toHaveValue("");
    await site.close();
    await panel.close();
  });
}
