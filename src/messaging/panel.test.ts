import { afterEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { openPanelOn, panelPathFor, panelTabId } from "./panel";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("panel path", () => {
  it("names the tab the panel belongs to, and reads it back", () => {
    expect(panelPathFor(42)).toBe("sidepanel.html?tabId=42");
    expect(panelTabId("?tabId=42")).toBe(42);
  });

  it("reads no tab from a path without a usable one", () => {
    expect(panelTabId("")).toBeUndefined();
    expect(panelTabId("?tabId=")).toBeUndefined();
    expect(panelTabId("?tabId=abc")).toBeUndefined();
    expect(panelTabId("?tabId=-1")).toBeUndefined();
  });
});

describe("openPanelOn", () => {
  function spies() {
    const setOptions = vi.fn(() => Promise.resolve());
    const open = vi.fn(() => Promise.resolve());
    vi.spyOn(browser, "sidePanel", "get").mockReturnValue({
      ...browser.sidePanel,
      setOptions,
      open,
    });
    return { setOptions, open };
  }

  it("switches the panel on for the clicked tab only and opens it there", () => {
    const { setOptions, open } = spies();
    openPanelOn({ id: 7 });
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 7,
      path: "sidepanel.html?tabId=7",
      enabled: true,
    });
    expect(open).toHaveBeenCalledWith({ tabId: 7 });
  });

  it("does nothing for a tab without an id", () => {
    const { setOptions, open } = spies();
    openPanelOn({});
    expect(setOptions).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
