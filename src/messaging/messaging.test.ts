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
  it("answers a message with its handler's result", async () => {
    handle({ ping: () => ({ type: "pong" }) });
    expect(await send({ type: "ping" })).toEqual({ type: "pong" });
  });

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
    handle({ ping: () => ({ type: "pong" }) });
    handle({ getListing: () => ({ kind: "not_listing" as const }) });
    expect(await send({ type: "getListing" })).toEqual({
      kind: "not_listing",
    });
  });

  it("stops answering once unsubscribed", async () => {
    const stop = handle({ ping: () => ({ type: "pong" }) });
    stop();
    await expect(send({ type: "ping" })).rejects.toThrow();
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
    toTab.mockResolvedValue({ ok: true, value: { type: "pong" } });
    expect(await send({ type: "ping" }, 7)).toEqual({ type: "pong" });
    expect(toTab).toHaveBeenCalledWith(7, { type: "ping" });
  });
});

describe("isMessage", () => {
  it("accepts known types and nothing else", () => {
    expect(isMessage({ type: "getListing" })).toBe(true);
    expect(isMessage({ type: "submit" })).toBe(false);
    expect(isMessage("ping")).toBe(false);
    expect(isMessage(null)).toBe(false);
  });
});
