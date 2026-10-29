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

  it("defaults to Sonnet and stores Haiku when picked", async () => {
    render(<ClaudeCard />);
    const sonnet = await screen.findByRole("button", { name: "Sonnet" });
    expect(sonnet.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Haiku, cheaper" }));
    await waitFor(async () => {
      expect(await read("settings")).toEqual({
        ok: true,
        value: { model: "claude-haiku-5-5" },
      });
    });
  });
});
