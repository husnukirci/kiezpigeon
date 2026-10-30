// README screenshots of the four screens (PHASES.md Phase 8), taken from the
// built extension with the invented profile and the scrubbed fixture.
// Skipped in the normal e2e run; `npm run screenshots` sets SCREENSHOTS=1
// and writes `docs/screenshots/*.png`. Claude is answered locally.
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
import type { Application } from "../src/rules/types";
import { coupleWithDog } from "../test-support/sample-profiles";

// Inside the extension's service worker, where `worker.evaluate` runs,
// `chrome` is the API that WXT wraps as `browser`.
declare const chrome: typeof browser;

test.skip(!process.env.SCREENSHOTS, "run with npm run screenshots");

const ROOT = join(import.meta.dirname, "..");
const EXTENSION = join(ROOT, ".output", "chrome-mv3");
const OUT = join(ROOT, "docs", "screenshots");
const EXPOSE = "https://www.immobilienscout24.de/expose/100000003";
const FIXTURE = readFileSync(
  join(ROOT, "fixtures", "immoscout24", "contact-form.html"),
  "utf8",
);
// A side panel is about this wide by default.
const PANEL = { width: 380, height: 760 };

// Invented, and written to pass the validator for `coupleWithDog` on the
// fixture: a company contact, the two preselected highlights, the dog.
const LETTER = `Sehr geehrte Damen und Herren,

wir interessieren uns für Ihre Wohnung und bewerben uns gern darum. Wir sind ein Paar.

Mara Testmann arbeitet als Softwareentwicklerin in unbefristeter Festanstellung, Jonas Beispiel ist verbeamteter Lehrer. Zusammen verdienen wir mehr als das Dreifache der Kaltmiete. Alle Unterlagen liegen vollständig vor.

Besonders gefallen uns der Balkon und der Keller. Offen gesagt: Unser ruhiger Hund würde mit einziehen.

Über eine Einladung zur Besichtigung freuen wir uns.

Mit freundlichen Grüßen
Mara Testmann und Jonas Beispiel`;

function app(
  id: string,
  status: Application["status"],
  listingTitle: string,
  sentAt: string,
): Application {
  return {
    id,
    listingUrl: `https://www.immobilienscout24.de/expose/${id.slice(4)}`,
    listingTitle,
    letter: "Sehr geehrte Damen und Herren, ...",
    status,
    sentAt,
    statusChangedAt: sentAt,
  };
}

let context: BrowserContext;
let extensionId: string;

async function store(data: Record<string, unknown>): Promise<void> {
  const worker = context.serviceWorkers()[0];
  await worker?.evaluate((d) => chrome.storage.local.set(d), data);
}

async function openPanel(tabId?: number): Promise<Page> {
  const panel = await context.newPage();
  await panel.setViewportSize(PANEL);
  const query = tabId === undefined ? "" : `?tabId=${tabId}`;
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html${query}`);
  return panel;
}

async function shoot(panel: Page, name: string): Promise<void> {
  await panel.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });
  await context.route(`${EXPOSE}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: FIXTURE }),
  );
  await context.route("https://api.anthropic.com/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_screenshots",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: [{ type: "text", text: LETTER }],
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
});

test.afterAll(async () => {
  await context.close();
});

test("the four screens", async () => {
  const onboarding = await openPanel();
  await expect(onboarding.getByRole("heading").first()).toBeVisible();
  await shoot(onboarding, "1-onboarding");
  await onboarding.close();

  await store({
    schemaVersion: 2,
    profile: coupleWithDog,
    apiKey: "screenshot-placeholder-not-a-key",
  });
  const listing = context.pages()[0] ?? (await context.newPage());
  await listing.goto(EXPOSE);
  const tabId = await context
    .serviceWorkers()[0]
    ?.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.id);

  const panel = await openPanel(tabId);
  await expect(panel.getByText(/Listing detected/)).toBeVisible();
  // The screen picks the first two highlights itself: Balkon and Keller.
  await shoot(panel, "2-listing-detected");

  await panel.getByRole("button", { name: "Write my letter" }).click();
  await expect(panel.getByText(/of \d+ matched/)).toBeVisible();
  await shoot(panel, "3-letter-ready");

  await store({
    applications: [
      app("app_100000011", "sent", "Altbau mit Balkon", "2027-02-03T09:30:00Z"),
      app(
        "app_100000012",
        "viewing",
        "Dachgeschoss am Park",
        "2027-01-28T18:10:00Z",
      ),
      app(
        "app_100000013",
        "sent",
        "Zwei Zimmer am Kanal",
        "2027-01-25T08:00:00Z",
      ),
      app(
        "app_100000014",
        "closed",
        "Neubau an der Spree",
        "2027-01-20T12:45:00Z",
      ),
    ],
  });
  await panel.getByRole("button", { name: "Your pigeons" }).click();
  await expect(
    panel.getByRole("list", { name: "Applications" }).getByRole("listitem"),
  ).toHaveCount(4);
  await shoot(panel, "4-tracker");
});
