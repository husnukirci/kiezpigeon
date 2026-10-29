import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
    ).toHaveProperty("disabled", true);
  });

  it("caps highlights at two and explains the third press", () => {
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={kreuzbergListing}
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
      />,
    );
    expect(screen.getAllByText("Not shown in listing")).toHaveLength(3);
    expect(screen.queryByText(/^0/)).toBeNull();
    expect(
      screen.getByText(/This listing names no features to highlight/),
    ).toBeDefined();
  });
});
