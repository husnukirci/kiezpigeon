import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { read, resetForTests } from "../../../storage/storage";
import { ClaudeCard } from "./ClaudeCard";

const KEY = "FAKE-KEY-0123456789";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});
afterEach(cleanup);

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
});
