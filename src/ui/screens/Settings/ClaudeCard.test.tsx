import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import * as storage from "../../../storage/storage";
import { read, resetForTests } from "../../../storage/storage";
import { ClaudeCard } from "./ClaudeCard";

const KEY = "FAKE-KEY-0123456789";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClaudeCard", () => {
  it("saves a pasted key, never shows it, and removes it", async () => {
    const { container } = render(<ClaudeCard />);
    const field = await screen.findByLabelText("API key");
    expect(field.getAttribute("type")).toBe("password");

    fireEvent.change(field, { target: { value: `  ${KEY} ` } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));

    expect(
      await screen.findByText(
        "Connected. Your key is saved in this browser only.",
      ),
    ).toBeDefined();
    expect(await read("apiKey")).toEqual({ ok: true, value: KEY });
    expect(container.innerHTML).not.toContain(KEY);

    fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
    expect(await screen.findByLabelText("API key")).toBeDefined();
    expect(await read("apiKey")).toEqual({ ok: true, value: undefined });
  });

  it("refuses an empty key with a hint", async () => {
    render(<ClaudeCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Save key" }));
    expect(
      screen.getByText("Paste the whole key. It has no spaces."),
    ).toBeDefined();
    expect(await read("apiKey")).toEqual({ ok: true, value: undefined });
  });

  it("defaults to Sonnet and stores the model you pick, with Fable's caveat", async () => {
    render(<ClaudeCard />);
    const select = await screen.findByLabelText("Model");
    expect((select as HTMLSelectElement).value).toBe("claude-sonnet-5-5");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Sonnet 5.5 (default)",
      "Opus 5.5 (best letters)",
      "Fable 5.1 (most capable)",
      "Haiku 5.5 (cheapest)",
    ]);
    expect(screen.getByText("Fast, about 1 cent a letter.")).toBeDefined();
    expect(screen.queryByText(/30-day data retention/)).toBeNull();

    fireEvent.change(select, { target: { value: "claude-fable-5-1" } });
    await waitFor(async () => {
      expect(await read("settings")).toEqual({
        ok: true,
        value: { model: "claude-fable-5-1" },
      });
    });
    expect(await screen.findByText(/30-day data retention/)).toBeDefined();
  });

  it("says so when the key could not be removed, and clears it on the next action", async () => {
    await storage.write("apiKey", KEY);
    render(<ClaudeCard />);
    const remove = vi
      .spyOn(storage, "remove")
      .mockRejectedValueOnce(new Error("storage unavailable"));
    fireEvent.click(await screen.findByRole("button", { name: "Remove key" }));
    expect(
      await screen.findByText("Your key could not be removed. Try again."),
    ).toBeDefined();
    expect(screen.getByText(/Connected/)).toBeDefined();

    remove.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
    expect(await screen.findByLabelText("API key")).toBeDefined();
    expect(screen.queryByText(/could not be removed/)).toBeNull();
  });

  it("says so when the model could not be changed and keeps the old one", async () => {
    render(<ClaudeCard />);
    const select = await screen.findByLabelText("Model");
    vi.spyOn(storage, "write").mockRejectedValueOnce(new Error("quota"));
    fireEvent.change(select, { target: { value: "claude-opus-5-5" } });
    expect(
      await screen.findByText("The model could not be changed. Try again."),
    ).toBeDefined();
    expect((select as HTMLSelectElement).value).toBe("claude-sonnet-5-5");

    fireEvent.change(select, { target: { value: "claude-opus-5-5" } });
    await waitFor(() => {
      expect(screen.queryByText(/could not be changed/)).toBeNull();
    });
    expect((select as HTMLSelectElement).value).toBe("claude-opus-5-5");
  });
});
