import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { browser, type Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { passingLetter } from "../../../../test-support/sample-letters";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../../../test-support/sample-profiles";
import { Home } from "./Home";

let toWorker: MockInstance<(message: unknown) => Promise<unknown>>;

beforeEach(() => {
  fakeBrowser.reset();
  // spyOn picks the callback overloads; the code uses the promise ones.
  const query = vi.spyOn(browser.tabs, "query") as unknown as MockInstance<
    () => Promise<Browser.tabs.Tab[]>
  >;
  query.mockResolvedValue([{ id: 7 } as Browser.tabs.Tab]);
  const toTab = vi.spyOn(
    browser.tabs,
    "sendMessage",
  ) as unknown as MockInstance<() => Promise<unknown>>;
  toTab.mockResolvedValue({
    ok: true,
    value: {
      kind: "listing",
      siteName: "ImmoScout24",
      listing: kreuzbergListing,
    },
  });
  toWorker = vi.spyOn(browser.runtime, "sendMessage");
  toWorker.mockResolvedValue({
    ok: true,
    value: {
      kind: "letter",
      draft: { text: passingLetter, problems: [], attempts: 1 },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Home", () => {
  it("asks for a letter only when you click Write my letter, then shows it", async () => {
    render(<Home profile={coupleWithDog} />);
    const write = await screen.findByRole("button", {
      name: "Write my letter",
    });
    expect(toWorker).not.toHaveBeenCalled();

    fireEvent.click(write);

    expect(
      await screen.findByRole("heading", { name: "Letter ready" }),
    ).toBeDefined();
    expect(toWorker).toHaveBeenCalledOnce();
    expect(toWorker.mock.calls[0]?.[0]).toMatchObject({
      type: "generateLetter",
      request: {
        tone: "warm",
        features: ["Balkon", "Altbau"],
        listing: { url: kreuzbergListing.url },
      },
    });

    // Back keeps the choice; switching tone writes again, once.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: "Warm" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Write my letter" }));
    await screen.findByRole("heading", { name: "Letter ready" });
    fireEvent.click(screen.getByRole("button", { name: "Formal" }));
    await screen.findByRole("heading", { name: "Letter ready" });
    expect(toWorker).toHaveBeenCalledTimes(3);
    expect(toWorker.mock.calls[2]?.[0]).toMatchObject({
      request: { tone: "formal" },
    });
  });
});
