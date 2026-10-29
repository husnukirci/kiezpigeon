import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
  sparseListing,
} from "../../../../test-support/sample-profiles";
import { ListingDetected } from "./ListingDetected";

afterEach(cleanup);

function chip(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("ListingDetected", () => {
  it("shows the badge, numbers, fit lines, tone and highlights", () => {
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={kreuzbergListing}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getByText("Listing detected · ImmoScout24")).toBeDefined();
    expect(
      screen.getByRole("heading", {
        name: "Helle 2-Zimmer-Altbauwohnung mit Balkon",
      }),
    ).toBeDefined();
    expect(screen.getByText("Kreuzberg · 62 m² · 3. OG")).toBeDefined();
    expect(screen.getByText("1.180 €")).toBeDefined();
    expect(screen.getByText("1.400 €")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();

    const fit = screen.getByRole("region", { name: "Fit check" });
    expect(fit.querySelectorAll("li")).toHaveLength(4);
    expect(fit.textContent).toContain("over your budget");

    expect(
      screen.getByRole("button", { name: "Warm" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Write my letter" }),
    ).toHaveProperty("disabled", false);
  });

  it("hands the tone and highlights to Write my letter, and needs one", () => {
    const onWrite = vi.fn();
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={kreuzbergListing}
        onWrite={onWrite}
      />,
    );
    const write = screen.getByRole("button", { name: "Write my letter" });
    fireEvent.click(screen.getByRole("button", { name: "Formal" }));
    fireEvent.click(chip("Balkon"));
    fireEvent.click(write);
    expect(onWrite).toHaveBeenCalledWith({
      tone: "formal",
      features: ["Altbau"],
    });

    fireEvent.click(chip("Altbau"));
    expect(write).toHaveProperty("disabled", true);
    expect(
      screen.getByText("Pick at least one highlight first."),
    ).toBeDefined();
  });

  it("caps highlights at two and explains the third press", () => {
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={kreuzbergListing}
        onWrite={vi.fn()}
      />,
    );
    expect(chip("Balkon").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Altbau").getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(chip("Einbauküche"));
    expect(chip("Einbauküche").getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByText("You can pick two. Unpick one to choose another."),
    ).toBeDefined();

    fireEvent.click(chip("Altbau"));
    fireEvent.click(chip("Einbauküche"));
    expect(chip("Einbauküche").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Altbau").getAttribute("aria-pressed")).toBe("false");
  });

  it("says what the listing did not show instead of showing 0", () => {
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={sparseListing}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Not shown in listing")).toHaveLength(3);
    expect(screen.queryByText(/^0/)).toBeNull();
    expect(
      screen.getByText(/This listing names no features to highlight/),
    ).toBeDefined();
  });
});
