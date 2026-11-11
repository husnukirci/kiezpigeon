import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { SiteAdapter } from "../adapters/types";
import { PAGE_ANSWERED } from "./fallback";
import { send } from "./messaging";
import { answerAs, READY_TIMEOUT_MS } from "./siteScript";

const adapter = (overrides: Partial<SiteAdapter>): SiteAdapter => ({
  id: "site",
  siteName: "Site",
  readListing: () => undefined,
  listingRoot: () => document.body,
  contactForm: () => undefined,
  readContactForm: () => [],
  ...overrides,
});

beforeEach(() => {
  fakeBrowser.reset();
  vi.stubGlobal(
    "location",
    new URL("https://flats.example/listing/1?tracking=token"),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("answerAs", () => {
  it("answers with the adapter's listing, without the query string", async () => {
    const readListing = vi.fn(() => ({
      url: "ignored",
      features: [],
      missing: [],
    }));
    answerAs(adapter({ readListing }));
    expect(await send({ type: "getListing" })).toMatchObject({
      kind: "listing",
      siteName: "Site",
    });
    expect(readListing).toHaveBeenCalledWith(
      document,
      "https://flats.example/listing/1",
    );
    expect(window).toHaveProperty(PAGE_ANSWERED, true);
  });

  it("waits for a page the site is still drawing", async () => {
    const readListing = vi.fn(() => ({
      url: "ignored",
      features: [],
      missing: [],
    }));
    answerAs(
      adapter({
        readListing,
        isReady: (page) => page.querySelector("h1") !== null,
      }),
    );
    const answer = send({ type: "getListing" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readListing).not.toHaveBeenCalled();
    document.body.append(document.createElement("h1"));
    expect(await answer).toMatchObject({ kind: "listing" });
    expect(readListing).toHaveBeenCalledTimes(1);
    document.querySelector("h1")?.remove();
  });

  it("answers with what it has when the page never finishes", async () => {
    vi.useFakeTimers();
    try {
      answerAs(adapter({ isReady: () => false }));
      const answer = send({ type: "getListing" });
      await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS);
      expect(await answer).toEqual({ kind: "not_listing", siteName: "Site" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("names its site when the page is not a listing", async () => {
    answerAs(adapter({}));
    expect(await send({ type: "getListing" })).toEqual({
      kind: "not_listing",
      siteName: "Site",
    });
  });

  it("has no form to read or fill until one is open", async () => {
    answerAs(adapter({}));
    expect(await send({ type: "getContactForm" })).toEqual({ kind: "no_form" });
    expect(await send({ type: "fillForm", steps: [], formKeys: [] })).toEqual({
      kind: "no_form",
    });
  });
});

describe("answerAs getPageText", () => {
  it("answers with the listing region's visible text", async () => {
    document.body.innerHTML = `<header>Mara Account</header><main id="m">Helle  Wohnung<script>x()</script></main>`;
    answerAs(
      adapter({ listingRoot: (page) => page.querySelector("#m") ?? undefined }),
    );
    expect(await send({ type: "getPageText" })).toEqual({
      kind: "text",
      text: "Helle Wohnung",
    });
  });

  it("answers no_text on a page with no listing region", async () => {
    answerAs(adapter({ listingRoot: () => undefined }));
    expect(await send({ type: "getPageText" })).toEqual({ kind: "no_text" });
  });

  it("answers no_text when the region has no text", async () => {
    document.body.innerHTML = `<main id="m">  <script>x()</script></main>`;
    answerAs(
      adapter({ listingRoot: (page) => page.querySelector("#m") ?? undefined }),
    );
    expect(await send({ type: "getPageText" })).toEqual({ kind: "no_text" });
  });
});
