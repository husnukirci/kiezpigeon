// The tracker's acceptance (PHASES.md Phase 7): three saved applications
// across statuses show the right counts and filter correctly, and closing
// Chrome keeps them. The built extension runs in Chromium on a profile
// directory of its own, which is closed and opened again in between.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import type { browser } from "wxt/browser";
import type { Application } from "../src/rules/types";
import { coupleWithDog } from "../test-support/sample-profiles";

// Inside the extension's service worker, where `worker.evaluate` runs,
// `chrome` is the API that WXT wraps as `browser`.
declare const chrome: typeof browser;

const EXTENSION = join(import.meta.dirname, "..", ".output", "chrome-mv3");

function app(
  id: string,
  status: Application["status"],
  listingTitle: string,
): Application {
  const sentAt = "2027-02-01T09:30:00.000Z";
  return {
    id,
    listingUrl: `https://www.immobilienscout24.de/expose/${id.slice(4)}`,
    listingTitle,
    letter: "Sehr geehrte Frau Weber, ...",
    status,
    sentAt,
    statusChangedAt: sentAt,
  };
}

async function launch(profileDir: string): Promise<{
  context: BrowserContext;
  extensionId: string;
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
  return { context, extensionId: new URL(worker.url()).host };
}

let profileDir: string;

test.beforeAll(() => {
  profileDir = mkdtempSync(join(tmpdir(), "kiezpigeon-tracker-"));
});

test.afterAll(() => {
  rmSync(profileDir, { recursive: true, force: true });
});

test("three applications keep their counts and filters after Chrome restarts", async () => {
  const first = await launch(profileDir);
  const worker = first.context.serviceWorkers()[0];
  await worker?.evaluate(
    (data) => chrome.storage.local.set({ schemaVersion: 2, ...data }),
    {
      profile: coupleWithDog,
      applications: [
        app("app_100000001", "sent", "Altbau mit Balkon"),
        app("app_100000002", "viewing", "Dachgeschoss am Park"),
        app("app_100000003", "closed", "Neubau an der Spree"),
      ],
    },
  );
  await first.context.close();

  const { context, extensionId } = await launch(profileDir);
  try {
    const panel = await context.newPage();
    const errors: string[] = [];
    panel.on("pageerror", (error) => errors.push(error.message));
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByRole("button", { name: "Your pigeons" }).click();

    // A tile's number is the stat-sized text just above its label.
    const tile = (label: string) =>
      panel
        .locator(`p:text-is("${label}")`)
        .locator("xpath=preceding-sibling::p[contains(@class, 'type-stat')]");
    await expect(tile("Sent")).toHaveText("3");
    await expect(tile("Viewings")).toHaveText("1");
    await expect(tile("Waiting")).toHaveText("1");

    const rows = panel
      .getByRole("list", { name: "Applications" })
      .getByRole("listitem");
    await expect(rows).toHaveCount(3);
    const filters = panel.getByRole("group", { name: "Filter" });
    await filters.getByRole("button", { name: "Viewing" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Dachgeschoss am Park");
    await filters.getByRole("button", { name: "Closed" }).click();
    await expect(rows).toHaveText([/Neubau an der Spree/]);
    await filters.getByRole("button", { name: "Sent" }).click();
    await expect(rows).toHaveText([/Altbau mit Balkon/]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
