// The never-submit run (CLAUDE.md "Never submit", PLAN.md section 5): the
// built extension in Chromium, the scrubbed contact form fixture served at
// an ImmoScout24 exposé address, the panel page opened by its URL, "Fill
// the form" pressed, and every way of sending the form watched. Claude is
// answered locally; no request leaves the machine.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import type { browser } from "wxt/browser";
import { passingLetter } from "../test-support/sample-letters";
import { coupleWithDog } from "../test-support/sample-profiles";

// Inside the extension's service worker, where `worker.evaluate` runs,
// `chrome` is the API that WXT wraps as `browser`.
declare const chrome: typeof browser;

const ROOT = join(import.meta.dirname, "..");
const EXTENSION = join(ROOT, ".output", "chrome-mv3");
const EXPOSE = "https://www.immobilienscout24.de/expose/100000003";
const FIXTURE = readFileSync(
  join(ROOT, "fixtures", "immoscout24", "contact-form.html"),
  "utf8",
);
const ENGLISH_EXPOSE = "https://www.immobilienscout24.de/en/expose/100000020";
const ENGLISH_FIXTURE = readFileSync(
  join(ROOT, "fixtures", "immoscout24", "en-contact-form.html"),
  "utf8",
);
const VONOVIA_LISTING =
  "https://www.vonovia.de/zuhause-finden/immobilien/helle-3-zimmer-wohnung-82-1000000001";
const VONOVIA_FIXTURE = readFileSync(
  join(ROOT, "fixtures", "vonovia", "contact-form.html"),
  "utf8",
);
const VONOVIA_LATE_LISTING =
  "https://www.vonovia.de/zuhause-finden/immobilien/spaete-wohnung-82-1000000002";
// The site draws its title just after the load event (the Phase 10 live check).
const VONOVIA_LATE_FIXTURE = readFileSync(
  join(ROOT, "fixtures", "vonovia", "listing-complete.html"),
  "utf8",
)
  .replace(/<h1[\s\S]*?<\/h1>/, "")
  .replace(
    "</body>",
    `<script>
      addEventListener("load", () => setTimeout(() => {
        const title = document.createElement("h1");
        title.textContent = "Helle 3-Zimmer-Wohnung mit Balkon";
        document.querySelector("main").prepend(title);
      }, 300));
    </script></body>`,
  );

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
let claudeCalls: number;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  pageLoads = [];
  claudeCalls = 0;
  // A form that is sent loads the exposé address again (GET or POST).
  await context.route(`${EXPOSE}**`, (route) => {
    pageLoads.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({ contentType: "text/html", body: FIXTURE });
  });
  await context.route(`${ENGLISH_EXPOSE}**`, (route) => {
    pageLoads.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({ contentType: "text/html", body: ENGLISH_FIXTURE });
  });
  await context.route(`${VONOVIA_LISTING}**`, (route) => {
    pageLoads.push(`${route.request().method()} ${route.request().url()}`);
    return route.fulfill({ contentType: "text/html", body: VONOVIA_FIXTURE });
  });
  await context.route(`${VONOVIA_LATE_LISTING}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: VONOVIA_LATE_FIXTURE }),
  );
  await context.route("https://api.anthropic.com/**", (route) => {
    claudeCalls += 1;
    return route.fulfill({
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
    });
  });
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

test("Fill the form fills the contact form and never sends it", async () => {
  const listing = context.pages()[0] ?? (await context.newPage());
  await listing.addInitScript(recordSendAttempts);
  await listing.goto(EXPOSE);
  await expect(
    listing.getByRole("dialog", { name: "Kontaktanfrage" }),
  ).toBeVisible();

  // The fixture is the only tab, so it is the active one.
  const worker = context.serviceWorkers()[0];
  const tabId = await worker?.evaluate(
    async () => (await chrome.tabs.query({ active: true }))[0]?.id,
  );
  expect(tabId).toBeDefined();

  const panel = await context.newPage();
  await panel.goto(
    `chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`,
  );
  await expect(panel.getByText(/Listing detected/)).toBeVisible();
  // The fixture names features, so one must be picked to write.
  await panel
    .getByRole("group", { name: "Highlights to mention" })
    .getByRole("button")
    .first()
    .click();
  await panel.getByRole("button", { name: "Write my letter" }).click();
  await expect(panel.getByText("14 of 15 matched")).toBeVisible();
  await expect(
    panel.getByText("Replaces what the page already has:", { exact: false }),
  ).toBeVisible();

  await panel.getByRole("button", { name: "Fill the form" }).click();
  await expect(
    panel.getByText("Filled 14 fields.", { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByText("You review and press Send yourself."),
  ).toBeVisible();

  // Nothing was sent: no second load of the page (a sent form reloads it),
  // and no submit, click or key event on it.
  await listing.waitForLoadState("networkidle");
  expect(pageLoads).toEqual([`GET ${EXPOSE}`]);
  expect(
    await listing.evaluate(
      () => (window as unknown as { sendAttempts: string[] }).sendAttempts,
    ),
  ).toEqual([]);
  expect(claudeCalls).toBeGreaterThan(0);

  const form = listing.getByTestId("contact-form");
  await expect(form.locator("[name=firstName]")).toHaveValue("Mara");
  await expect(form.locator("[name=phoneNumber]")).toHaveValue("030 5550123");
  await expect(form.locator("[name=hasPets]")).toHaveValue("TRUE");
  await expect(form.locator("[name=income]")).toHaveValue(
    "OVER_4000_UPTO_5000",
  );
  await expect(form.locator("[name=message]")).not.toHaveValue("");
  await expect(form.locator("[name=salutation]")).toHaveValue("");
  await expect(form.locator("[name=followAnAgent]")).toBeChecked();
  await expect(
    form.locator("#is24-checkbox-isRelocationOfferChecked-input"),
  ).not.toBeChecked();

  // Only the user says it was sent; then it is tracked, and still nothing
  // reached the page.
  await panel.getByRole("button", { name: "Yes, I sent it" }).click();
  await expect(panel.getByText(/In your pigeons, marked Sent/)).toBeVisible();
  await panel.getByRole("button", { name: "Your pigeons" }).click();
  const rows = panel
    .getByRole("list", { name: "Applications" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.getByText("Sent", { exact: true })).toBeVisible();
  await expect(
    rows.getByRole("link", { name: "Open listing" }),
  ).toHaveAttribute("href", EXPOSE);
  expect(pageLoads).toEqual([`GET ${EXPOSE}`]);
  expect(
    await listing.evaluate(
      () => (window as unknown as { sendAttempts: string[] }).sendAttempts,
    ),
  ).toEqual([]);
});

test("the English contact form is filled the same way and never sent", async () => {
  pageLoads.length = 0;
  const listing = await context.newPage();
  await listing.addInitScript(recordSendAttempts);
  await listing.goto(ENGLISH_EXPOSE);
  await expect(
    listing.getByRole("dialog", { name: "Contact request" }),
  ).toBeVisible();

  await listing.bringToFront();
  const worker = context.serviceWorkers()[0];
  const tabId = await worker?.evaluate(
    async () => (await chrome.tabs.query({ active: true }))[0]?.id,
  );
  expect(tabId).toBeDefined();

  const panel = await context.newPage();
  await panel.goto(
    `chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`,
  );
  await expect(panel.getByText(/Listing detected/)).toBeVisible();
  const highlights = panel.getByRole("group", {
    name: "Highlights to mention",
  });
  // Features stay German on the English page, so the letter does too.
  await expect(
    highlights.getByRole("button", { name: /Balkon/ }),
  ).toBeVisible();
  await highlights.getByRole("button").first().click();
  await panel.getByRole("button", { name: "Write my letter" }).click();
  await expect(panel.getByText("14 of 15 matched")).toBeVisible();

  await panel.getByRole("button", { name: "Fill the form" }).click();
  await expect(
    panel.getByText("Filled 14 fields.", { exact: false }),
  ).toBeVisible();

  await listing.waitForLoadState("networkidle");
  expect(pageLoads).toEqual([`GET ${ENGLISH_EXPOSE}`]);
  expect(
    await listing.evaluate(
      () => (window as unknown as { sendAttempts: string[] }).sendAttempts,
    ),
  ).toEqual([]);

  const form = listing.getByTestId("contact-form");
  await expect(form.locator("[name=firstName]")).toHaveValue("Mara");
  await expect(form.locator("[name=hasPets]")).toHaveValue("TRUE");
  await expect(form.locator("[name=income]")).toHaveValue(
    "OVER_4000_UPTO_5000",
  );
  await expect(form.locator("[name=message]")).not.toHaveValue("");
  await expect(form.locator("[name=salutation]")).toHaveValue("");
  await expect(form.locator("[name=sendUserProfile]")).toBeChecked();
  await expect(
    form.locator("#is24-checkbox-isRelocationOfferChecked-input"),
  ).not.toBeChecked();
});

test("the Vonovia form is filled, its hidden selects too, and never sent", async () => {
  pageLoads.length = 0;
  const listing = await context.newPage();
  await listing.addInitScript(recordSendAttempts);
  await listing.goto(VONOVIA_LISTING);

  await listing.bringToFront();
  const worker = context.serviceWorkers()[0];
  const tabId = await worker?.evaluate(
    async () => (await chrome.tabs.query({ active: true }))[0]?.id,
  );
  expect(tabId).toBeDefined();

  const panel = await context.newPage();
  await panel.goto(
    `chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`,
  );
  await expect(panel.getByText(/Listing detected · Vonovia/)).toBeVisible();
  await panel
    .getByRole("group", { name: "Highlights to mention" })
    .getByRole("button")
    .first()
    .click();
  await panel.getByRole("button", { name: "Write my letter" }).click();
  await expect(panel.getByText("7 of 7 matched")).toBeVisible();

  await panel.getByRole("button", { name: "Fill the form" }).click();
  await expect(
    panel.getByText("Filled 7 fields.", { exact: false }),
  ).toBeVisible();

  await listing.waitForLoadState("networkidle");
  expect(pageLoads).toEqual([`GET ${VONOVIA_LISTING}`]);
  expect(
    await listing.evaluate(
      () => (window as unknown as { sendAttempts: string[] }).sendAttempts,
    ),
  ).toEqual([]);

  const form = listing.locator("form[name=real-estate-contact-form]");
  await expect(form.locator("[name=firstname]")).toHaveValue("Mara");
  await expect(form.locator("[name=telephone]")).toHaveValue("030 5550123");
  await expect(form.locator("[name=einkommensart]")).toHaveValue("1");
  await expect(form.locator("[name=monatliches_nettoeinkommen]")).toHaveValue(
    "M_3",
  );
  await expect(form.locator("[name=message]")).not.toHaveValue("");
  // The listing's own id, the hidden field a person never touches.
  await expect(form.locator("[name=wrkID]")).toHaveValue("1000000001");
});

test("a reload with the panel open waits for a title the site draws late", async () => {
  const listing = await context.newPage();
  await listing.goto(VONOVIA_LATE_LISTING);
  await listing.bringToFront();
  const worker = context.serviceWorkers()[0];
  const tabId = await worker?.evaluate(
    async () => (await chrome.tabs.query({ active: true }))[0]?.id,
  );
  const panel = await context.newPage();
  await panel.goto(
    `chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`,
  );
  const title = panel.getByRole("heading", {
    name: "Helle 3-Zimmer-Wohnung mit Balkon",
  });
  await expect(title).toBeVisible();

  await listing.reload();
  await listing.locator("h1").waitFor();
  // Long enough for the panel to have asked again and drawn its answer.
  await panel.waitForTimeout(500);
  await expect(panel.getByText("Untitled listing")).toBeHidden();
  await expect(title).toBeVisible();
});
