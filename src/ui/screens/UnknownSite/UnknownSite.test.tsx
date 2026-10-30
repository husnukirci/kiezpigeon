import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { coupleWithDog } from "../../../../test-support/sample-profiles";
import { UnknownSite } from "./UnknownSite";

const SITE = "https://flats.example/wohnung/17";

// The fake browser has no `scripting`; each test puts in its own.
function stubExecuteScript(answer: () => Promise<unknown>) {
  const executeScript = vi.fn(answer);
  Object.defineProperty(browser, "scripting", {
    value: { executeScript },
    configurable: true,
  });
  return executeScript;
}

beforeEach(() => {
  fakeBrowser.reset();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(browser, "scripting");
});

const usePage = () => {
  fireEvent.click(screen.getByRole("button", { name: "Use this page" }));
};

describe("UnknownSite", () => {
  it("reads nothing until you press Use this page, then asks for the facts", async () => {
    const executeScript = stubExecuteScript(() =>
      Promise.resolve([{ frameId: 0, result: SITE }]),
    );
    render(<UnknownSite ownTab={7} profile={coupleWithDog} />);
    expect(
      screen.getByRole("heading", { name: "Ready when you are, Mara" }),
    ).toBeDefined();
    expect(executeScript).not.toHaveBeenCalled();

    usePage();
    expect(
      await screen.findByRole("heading", { name: "About this flat" }),
    ).toBeDefined();
    expect(executeScript).toHaveBeenCalledOnce();
    expect(screen.getByText(/does not know flats\.example/)).toBeDefined();
  });

  it("builds the listing screen from the facts you typed, and keeps them on Back", async () => {
    stubExecuteScript(() => Promise.resolve([{ frameId: 0, result: SITE }]));
    render(<UnknownSite ownTab={7} profile={coupleWithDog} />);
    usePage();
    await screen.findByRole("heading", { name: "About this flat" });

    const type = (label: string, value: string) => {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    };
    type("Listing title", "2 Zimmer am Park");
    type("Kaltmiete in €", "980");
    type("Salutation", "Frau");
    type("Contact person's last name", "Okafor");
    type("Features, separated by commas", "Balkon, Altbau");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByText("Your listing facts · flats.example"),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "2 Zimmer am Park" }),
    ).toBeDefined();
    expect(screen.getByText("980 €")).toBeDefined();
    expect(screen.getByRole("button", { name: "Balkon" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Contact person's last name")).toHaveProperty(
      "value",
      "Okafor",
    );
  });

  it("shows a fact it cannot read under its field and stays", async () => {
    stubExecuteScript(() => Promise.resolve([{ frameId: 0, result: SITE }]));
    render(<UnknownSite ownTab={7} profile={coupleWithDog} />);
    usePage();
    await screen.findByRole("heading", { name: "About this flat" });
    fireEvent.change(screen.getByLabelText("Kaltmiete in €"), {
      target: { value: "viel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("Write the amount like 2.600 or 2.600,50"),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "About this flat" }),
    ).toBeDefined();
  });

  it("asks for the icon click when the page cannot be read", async () => {
    stubExecuteScript(() =>
      Promise.reject(new Error("Cannot access contents of the page.")),
    );
    render(<UnknownSite ownTab={7} profile={coupleWithDog} />);
    usePage();
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(
        /Click the Kiezpigeon icon in the toolbar/,
      );
    });
    expect(
      screen.getByRole("button", { name: "Use this page" }),
    ).toHaveProperty("disabled", false);
  });
});
