import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { SiteAdapter } from "../adapters/types";
import { PAGE_ANSWERED } from "./fallback";
import { send } from "./messaging";
import { answerAs } from "./siteScript";

const adapter = (overrides: Partial<SiteAdapter>): SiteAdapter => ({
  id: "site",
  siteName: "Site",
  matches: () => true,
  readListing: () => undefined,
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
