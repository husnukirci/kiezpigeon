import { afterEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { FALLBACK_SCRIPT, injectFallback } from "./fallback";

// The fake browser has no `scripting`; each test puts in its own.
function stubExecuteScript(answer: () => Promise<unknown>) {
  const executeScript = vi.fn(answer);
  Object.defineProperty(browser, "scripting", {
    value: { executeScript },
    configurable: true,
  });
  return executeScript;
}

afterEach(() => {
  Reflect.deleteProperty(browser, "scripting");
});

describe("injectFallback", () => {
  it("injects the reader into the tab and answers with its address", async () => {
    const executeScript = stubExecuteScript(() =>
      Promise.resolve([{ frameId: 0, result: "https://flats.example/17" }]),
    );
    await expect(injectFallback(42)).resolves.toBe("https://flats.example/17");
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: [FALLBACK_SCRIPT],
    });
  });

  it("rejects when Kiezpigeon may not read the tab", async () => {
    stubExecuteScript(() =>
      Promise.reject(new Error("Cannot access contents of the page.")),
    );
    await expect(injectFallback(42)).rejects.toThrow("Cannot access");
  });

  it("rejects when the page gives no address back", async () => {
    stubExecuteScript(() => Promise.resolve([{ frameId: 0 }]));
    await expect(injectFallback(42)).rejects.toThrow("did not answer");
  });
});
