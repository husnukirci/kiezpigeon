import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { coupleWithDog } from "../../test-support/sample-profiles";
import { resetForTests, write } from "../storage/storage";
import { App } from "./App";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});
afterEach(cleanup);

describe("App", () => {
  it("shows the header with the wordmark and labelled tracker and settings buttons", () => {
    render(<App />);
    expect(screen.getByRole("banner").textContent).toBe("Kiezpigeon");
    expect(screen.getByRole("button", { name: "Your pigeons" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Settings" })).toBeDefined();
  });

  it("hides the sky decoration from assistive tech", () => {
    const { container } = render(<App />);
    const decorations = container.querySelectorAll('div[aria-hidden="true"]');
    for (const el of decorations) {
      expect(el.textContent).toBe("");
    }
    expect(decorations.length).toBeGreaterThanOrEqual(4);
  });

  it("opens onboarding on a fresh install", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "About you" }),
    ).toBeDefined();
  });

  it("shows home once a profile is stored, and settings from the header", async () => {
    await write("profile", coupleWithDog);
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Ready when you are, Mara" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(
      await screen.findByRole("heading", { name: "Ready when you are, Mara" }),
    ).toBeDefined();
  });
});
