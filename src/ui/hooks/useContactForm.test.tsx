import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { FillStep } from "../../fill/fill";
import type { FormField } from "../../rules/types";
import { useContactForm } from "./useContactForm";

let toTab: MockInstance<(tabId: number, message: unknown) => Promise<unknown>>;

beforeEach(() => {
  fakeBrowser.reset();
  // spyOn picks the callback overloads; the hook uses the promise ones.
  toTab = vi.spyOn(browser.tabs, "sendMessage");
});
afterEach(cleanup);

const fields: FormField[] = [
  { key: "name:firstName", type: "text", visible: true, disabled: false },
];
const ok = (value: unknown) => ({ ok: true, value });

describe("useContactForm", () => {
  it("reads its own tab's form when it opens, and again after a fill", async () => {
    toTab.mockImplementation((_tab, message) =>
      Promise.resolve(
        (message as { type: string }).type === "fillForm"
          ? ok({
              kind: "filled",
              report: { filled: ["name:firstName"], skipped: [] },
            })
          : ok({ kind: "form", fields }),
      ),
    );
    const { result } = renderHook(() => useContactForm(7));
    expect(result.current.state).toEqual({ status: "checking" });
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "form", fields });
    });
    expect(toTab).toHaveBeenCalledWith(7, { type: "getContactForm" });

    const steps: FillStep[] = [
      { key: "name:firstName", kind: "firstName", value: "Mara" },
    ];
    act(() => {
      result.current.fill(steps, ["name:firstName"]);
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: "form",
        fields,
        report: { filled: ["name:firstName"], skipped: [] },
      });
    });
    expect(toTab).toHaveBeenCalledWith(7, {
      type: "fillForm",
      steps,
      formKeys: ["name:firstName"],
    });
    expect(toTab).toHaveBeenCalledTimes(3);
  });

  it("says when the page cannot be reached, and when no form is open", async () => {
    toTab.mockRejectedValueOnce(new Error("Receiving end does not exist."));
    const { result } = renderHook(() => useContactForm(7));
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "unreachable" });
    });
    toTab.mockResolvedValueOnce(ok({ kind: "no_form" }));
    act(() => {
      result.current.check();
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "no_form" });
    });
  });

  it("prepares the tab before every read and fill on an unknown site", async () => {
    const order: string[] = [];
    const prepare = vi.fn((tabId: number) => {
      order.push(`prepare ${tabId}`);
      return Promise.resolve();
    });
    toTab.mockImplementation((_tab, message) => {
      const { type } = message as { type: string };
      order.push(type);
      return Promise.resolve(
        type === "fillForm"
          ? ok({ kind: "filled", report: { filled: [], skipped: [] } })
          : ok({ kind: "form", fields }),
      );
    });
    const { result } = renderHook(() => useContactForm(7, prepare));
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "form", fields });
    });
    act(() => {
      result.current.fill([], []);
    });
    await waitFor(() => {
      expect(order).toHaveLength(6);
    });
    expect(order).toEqual([
      "prepare 7",
      "getContactForm",
      "prepare 7",
      "fillForm",
      "prepare 7",
      "getContactForm",
    ]);
  });

  it("says the page cannot be reached when preparing it fails", async () => {
    const prepare = () => Promise.reject(new Error("Cannot access contents"));
    const { result } = renderHook(() => useContactForm(7, prepare));
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "unreachable" });
    });
    expect(toTab).not.toHaveBeenCalled();
  });

  it("reads the form again and fills nothing when it changed since shown", async () => {
    toTab.mockImplementation((_tab, message) =>
      Promise.resolve(
        (message as { type: string }).type === "fillForm"
          ? ok({ kind: "changed" })
          : ok({ kind: "form", fields }),
      ),
    );
    const { result } = renderHook(() => useContactForm(7));
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "form", fields });
    });
    act(() => {
      result.current.fill([], ["name:old"]);
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: "form",
        fields,
        changed: true,
      });
    });
  });

  it("reads the form again when its tab loads a page", async () => {
    toTab.mockResolvedValueOnce(ok({ kind: "form", fields }));
    toTab.mockResolvedValueOnce(ok({ kind: "no_form" }));
    const { result, rerender } = renderHook(
      ({ loads }) => useContactForm(7, undefined, loads),
      { initialProps: { loads: 0 } },
    );
    await waitFor(() => {
      expect(result.current.state.status).toBe("form");
    });
    rerender({ loads: 1 });
    expect(result.current.state.status).toBe("checking");
    await waitFor(() => {
      expect(result.current.state.status).toBe("no_form");
    });
  });

  it("drops the old page's fill report and its late answer on a reload", async () => {
    const reply = (value: unknown) => Promise.resolve(ok(value));
    let answerOld: (value: unknown) => void = () => undefined;
    const old = new Promise((resolve) => {
      answerOld = resolve;
    });
    // First read stays pending across the reload.
    toTab.mockReturnValueOnce(old);
    toTab.mockImplementationOnce(() => reply({ kind: "no_form" }));
    const { result, rerender } = renderHook(
      ({ loads }) => useContactForm(7, undefined, loads),
      { initialProps: { loads: 0 } },
    );
    rerender({ loads: 1 });
    await waitFor(() => {
      expect(result.current.state.status).toBe("no_form");
    });
    await act(async () => {
      answerOld(ok({ kind: "form", fields }));
      await old;
    });
    expect(result.current.state).toEqual({ status: "no_form" });
  });

  it("does not keep a fill report across a reload", async () => {
    toTab.mockImplementation((_tab, message) =>
      Promise.resolve(
        (message as { type: string }).type === "fillForm"
          ? ok({
              kind: "filled",
              report: { filled: ["name:firstName"], skipped: [] },
            })
          : ok({ kind: "form", fields }),
      ),
    );
    const { result, rerender } = renderHook(
      ({ loads }) => useContactForm(7, undefined, loads),
      { initialProps: { loads: 0 } },
    );
    await waitFor(() => {
      expect(result.current.state.status).toBe("form");
    });
    act(() => {
      result.current.fill([], ["name:firstName"]);
    });
    await waitFor(() => {
      expect(result.current.state).toHaveProperty("report");
    });
    rerender({ loads: 1 });
    expect(result.current.state).toEqual({ status: "checking" });
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "form", fields });
    });
  });
});
