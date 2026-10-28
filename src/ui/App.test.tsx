import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("App placeholder", () => {
  it("shows the header with the wordmark and a labelled settings button", () => {
    render(<App />);
    expect(screen.getByRole("banner").textContent).toBe("Kiezpigeon");
    expect(screen.getByRole("button", { name: "Settings" })).toBeDefined();
  });

  it("hides the sky decoration from assistive tech", () => {
    const { container } = render(<App />);
    const decorations = container.querySelectorAll('[aria-hidden="true"]');
    for (const el of decorations) {
      expect(el.textContent).toBe("");
    }
    expect(decorations.length).toBeGreaterThanOrEqual(4);
  });
});
