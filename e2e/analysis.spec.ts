// "Analyse this listing" in the built extension: the scrubbed ImmoScout24
// fixture at an exposé address, with a signed-in page header carrying the
// profile's email OUTSIDE the listing region, the panel page opened by its
// URL, and the request to the API caught. The text sent must come from the
// listing region only (the header is never read), carry no applicant name
// or email, name the fixed model, and leave only on the click. Nothing
// reaches the real API; the key is a placeholder.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import type { browser } from "wxt/browser";
import { coupleWithDog } from "../test-support/sample-profiles";
import { launchExtension, openPanel } from "./support";

// Inside the extension's service worker, where `worker.evaluate` runs,
// `chrome` is the API that WXT wraps as `browser`.
declare const chrome: typeof browser;

const ROOT = join(import.meta.dirname, "..");
const EXPOSE = "https://www.immobilienscout24.de/expose/100000031";
const EMAIL = coupleWithDog.contact.email;
const HEADINGS = [
  "What this is",
  "The area",
  "Price",
  "Heating and energy",
  "For you",
  "What to watch for",
];
// The header sits before the page wrapper, outside `#is24-content`.
const FIXTURE = readFileSync(
  join(ROOT, "fixtures", "immoscout24", "contact-form.html"),
  "utf8",
).replace(
  '<div class="viewport">',
  `<header id="is24-header"><p>Signed in as ${EMAIL}</p></header><div class="viewport">`,
);
const ANSWER = HEADINGS.map(
  (heading) => `## ${heading}\nRoughly fine, an estimate for this page.`,
).join("\n\n");

let context: BrowserContext;
let extensionId: string;
let requests: { url: string; body: string }[];

test.beforeAll(async () => {
  const launched = await launchExtension();
  ({ context, extensionId } = launched);
  requests = [];
  await context.route(`${EXPOSE}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: FIXTURE }),
  );
  await context.route("https://api.anthropic.com/**", (route) => {
    requests.push({
      url: route.request().url(),
      body: route.request().postData() ?? "",
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_e2e",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text: ANSWER }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
  });
  await launched.worker.evaluate(
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

test("the analysis leaves only on the click and carries no names or email", async () => {
  const listing = context.pages()[0] ?? (await context.newPage());
  await listing.goto(EXPOSE);
  await expect(listing.locator("#is24-header")).toContainText(EMAIL);

  const tabId = await context
    .serviceWorkers()[0]
    ?.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.id);
  expect(tabId).toBeDefined();

  const panel = await openPanel(context, extensionId, { tabId });
  await expect(panel.getByText(/Listing detected/)).toBeVisible();
  // Opening the panel sends nothing.
  expect(requests).toHaveLength(0);

  await panel.getByRole("button", { name: "Analyse this listing" }).click();
  for (const heading of HEADINGS) {
    await expect(
      panel.getByRole("heading", { level: 3, name: heading }),
    ).toBeVisible();
  }

  expect(requests).toHaveLength(1);
  const [request] = requests;
  expect(request?.url).toContain("https://api.anthropic.com/");
  const body = request?.body ?? "";
  expect(JSON.parse(body)).toMatchObject({ model: "claude-opus-5-5" });
  const lower = body.toLowerCase();
  for (const applicant of coupleWithDog.applicants) {
    // Whole words: the page names a landlord company that starts with a
    // surname, and that is the listing's own text.
    for (const name of [applicant.firstName, applicant.lastName]) {
      expect(lower).not.toMatch(
        new RegExp(
          `(?<![\\p{L}\\p{N}])${name.toLowerCase()}(?![\\p{L}\\p{N}])`,
          "u",
        ),
      );
    }
  }
  expect(lower).not.toContain(EMAIL.toLowerCase());
  // The header was outside the listing region, so it was never read.
  expect(lower).not.toContain("signed in as");
  // The listing's own text did go.
  expect(body).toContain("Musterallee");
});
