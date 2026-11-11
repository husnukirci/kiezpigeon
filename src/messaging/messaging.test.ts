import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { kreuzbergListing } from "../../test-support/sample-profiles";
import { handle, isMessage, send } from "./messaging";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("send and handle", () => {
  it("waits for an asynchronous handler", async () => {
    handle({
      getListing: () =>
        Promise.resolve({
          kind: "listing" as const,
          siteName: "ImmoScout24",
          listing: kreuzbergListing,
        }),
    });
    expect(await send({ type: "getListing" })).toEqual({
      kind: "listing",
      siteName: "ImmoScout24",
      listing: kreuzbergListing,
    });
  });

  it("rejects when the handler throws, instead of answering", async () => {
    handle({
      getListing: () => {
        throw new Error("page changed");
      },
    });
    await expect(send({ type: "getListing" })).rejects.toThrow("page changed");
  });

  it("stays silent on a type it has no handler for", async () => {
    handle({ getContactForm: () => ({ kind: "no_form" as const }) });
    handle({
      getListing: () => ({
        kind: "not_listing" as const,
        siteName: "ImmoScout24",
      }),
    });
    expect(await send({ type: "getListing" })).toEqual({
      kind: "not_listing",
      siteName: "ImmoScout24",
    });
  });

  it("stops answering once unsubscribed", async () => {
    const stop = handle({
      getContactForm: () => ({ kind: "no_form" as const }),
    });
    stop();
    await expect(send({ type: "getContactForm" })).rejects.toThrow();
  });

  it("sends to a tab's content script when given a tab id", async () => {
    // spyOn picks the callback overload, which returns void; the promise
    // overload is the one send() uses.
    const toTab = vi.spyOn(
      browser.tabs,
      "sendMessage",
    ) as unknown as MockInstance<
      (tabId: number, message: unknown) => Promise<unknown>
    >;
    toTab.mockResolvedValue({ ok: true, value: { kind: "no_form" } });
    expect(await send({ type: "getContactForm" }, 7)).toEqual({
      kind: "no_form",
    });
    expect(toTab).toHaveBeenCalledWith(7, { type: "getContactForm" });
  });
});

describe("isMessage", () => {
  it("accepts known types and nothing else", () => {
    expect(isMessage({ type: "getListing" })).toBe(true);
    expect(isMessage({ type: "getContactForm" })).toBe(true);
    expect(isMessage({ type: "fillForm", steps: [] })).toBe(true);
    expect(isMessage({ type: "submit" })).toBe(false);
    expect(isMessage("getListing")).toBe(false);
    expect(isMessage(null)).toBe(false);
  });
});
