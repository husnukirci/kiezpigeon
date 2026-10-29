import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { soloStudent } from "../../../test-support/sample-profiles";
import { clearAll, resetForTests, write } from "../../storage/storage";
import { useStored } from "./useStored";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});
afterEach(cleanup);

describe("useStored", () => {
  it("loads, then follows writes and a delete all", async () => {
    const { result } = renderHook(() => useStored("profile"));
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", value: undefined });
    });

    await act(() => write("profile", soloStudent));
    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", value: soloStudent });
    });

    await act(() => clearAll());
    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", value: undefined });
    });
  });

  it("reports a damaged stored value as invalid with its problems", async () => {
    await fakeBrowser.storage.local.set({ schemaVersion: 1, applications: {} });
    const { result } = renderHook(() => useStored("applications"));
    await waitFor(() => {
      expect(result.current).toEqual({
        status: "invalid",
        problems: ["applications: must be a list"],
      });
    });
  });
});
