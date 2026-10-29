import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { browser, type Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { kreuzbergListing } from "../../../test-support/sample-profiles";
import { useActiveListing } from "./useActiveListing";

let toTab: MockInstance<(tabId: number, message: unknown) => Promise<unknown>>;
let activeTabId = 7;

beforeEach(() => {
  fakeBrowser.reset();
  // spyOn picks the callback overloads; the hook uses the promise ones.
  toTab = vi.spyOn(browser.tabs, "sendMessage");
  const query = vi.spyOn(browser.tabs, "query") as unknown as MockInstance<
    () => Promise<Browser.tabs.Tab[]>
  >;
  query.mockImplementation(() => Promise.resolve([tab(activeTabId)]));
});
afterEach(cleanup);

/** Only the id matters to the hook. */
function tab(id: number): Browser.tabs.Tab {
  return { id } as Browser.tabs.Tab;
}

const detected = {
  kind: "listing",
  siteName: "ImmoScout24",
  listing: kreuzbergListing,
};

describe("useActiveListing", () => {
  it("asks the active tab's content script for its listing", async () => {
    activeTabId = 7;
    toTab.mockResolvedValue({ ok: true, value: detected });
    const { result } = renderHook(() => useActiveListing());
    expect(result.current).toEqual({ kind: "loading" });
    await waitFor(() => {
      expect(result.current).toEqual(detected);
    });
    expect(toTab).toHaveBeenCalledWith(7, { type: "getListing" });
  });

  it("treats a tab without a content script as not a listing, and asks again on a tab switch", async () => {
    activeTabId = 7;
    toTab.mockRejectedValue(new Error("Receiving end does not exist."));
    const { result } = renderHook(() => useActiveListing());
    await waitFor(() => {
      expect(result.current).toEqual({ kind: "not_listing" });
    });

    toTab.mockResolvedValue({ ok: true, value: detected });
    activeTabId = 8;
    await fakeBrowser.tabs.onActivated.trigger({ tabId: 8, windowId: 1 });
    await waitFor(() => {
      expect(result.current).toEqual(detected);
    });
    expect(toTab).toHaveBeenLastCalledWith(8, { type: "getListing" });
  });

  it("treats a failed tab lookup as not a listing", async () => {
    vi.mocked(browser.tabs.query).mockRejectedValue(new Error("No window"));
    const { result } = renderHook(() => useActiveListing());
    await waitFor(() => {
      expect(result.current).toEqual({ kind: "not_listing" });
    });
  });

  it("asks again when a tab finishes loading, not while it loads", async () => {
    toTab.mockResolvedValue({ ok: true, value: { kind: "not_listing" } });
    renderHook(() => useActiveListing());
    await waitFor(() => {
      expect(toTab).toHaveBeenCalledTimes(1);
    });
    await fakeBrowser.tabs.onUpdated.trigger(7, { status: "loading" }, tab(7));
    await fakeBrowser.tabs.onUpdated.trigger(7, { status: "complete" }, tab(7));
    await waitFor(() => {
      expect(toTab).toHaveBeenCalledTimes(2);
    });
  });

  it("stays with its own tab: asks only it, ignores tab switches and other tabs", async () => {
    activeTabId = 9;
    toTab.mockResolvedValue({ ok: true, value: detected });
    const { result } = renderHook(() => useActiveListing(7));
    await waitFor(() => {
      expect(result.current).toEqual(detected);
    });
    expect(toTab).toHaveBeenCalledTimes(1);
    expect(toTab).toHaveBeenLastCalledWith(7, { type: "getListing" });
    expect(browser.tabs.query).not.toHaveBeenCalled();

    await fakeBrowser.tabs.onActivated.trigger({ tabId: 9, windowId: 1 });
    await fakeBrowser.tabs.onUpdated.trigger(9, { status: "complete" }, tab(9));
    await fakeBrowser.tabs.onUpdated.trigger(7, { status: "complete" }, tab(7));
    await waitFor(() => {
      expect(toTab).toHaveBeenCalledTimes(2);
    });
    expect(toTab.mock.calls.map(([id]) => id)).toEqual([7, 7]);
  });
});
