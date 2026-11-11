import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { browser } from "wxt/browser";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
  sparseListing,
} from "../../../../test-support/sample-profiles";
import { ANALYSIS_HEADINGS } from "../../../rules/analysisPrompt";
import type { AnalysisSection } from "../../../rules/analysisParse";
import type { AnalysisState } from "../../hooks/useAnalysis";
import { ListingFlow } from "../Home/ListingFlow";
import { ListingAnalysis } from "./ListingAnalysis";
import { ListingDetected } from "./ListingDetected";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sections: AnalysisSection[] = ANALYSIS_HEADINGS.map((heading) => ({
  heading,
  text: `First paragraph of ${heading}.\n\nSecond paragraph.`,
}));
const NEUTRAL = /\b(claude|anthropic|ai|model|assistant)\b/i;

describe("ListingAnalysis", () => {
  it("offers the button when idle and asks on click", () => {
    const onAnalyse = vi.fn();
    render(
      <ListingAnalysis state={{ status: "idle" }} onAnalyse={onAnalyse} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Analyse this listing" }),
    );
    expect(onAnalyse).toHaveBeenCalledOnce();
  });

  it("says it is reading and disables the button", () => {
    render(
      <ListingAnalysis state={{ status: "reading" }} onAnalyse={vi.fn()} />,
    );
    expect(screen.getByRole("status").textContent).toBe("Reading the listing");
    expect(
      screen
        .getByRole("button", { name: "Analyse this listing" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the sections as level-3 headings, in order, with the caption", () => {
    render(
      <ListingAnalysis
        state={{ status: "ready", sections }}
        onAnalyse={vi.fn()}
      />,
    );
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([...ANALYSIS_HEADINGS]);
    expect(screen.getAllByText("Second paragraph.")).toHaveLength(6);
    expect(
      screen.getByText(/An estimate from the page and what is known/),
    ).toBeDefined();
  });

  it("shows a failure as an alert with Try again", () => {
    render(
      <ListingAnalysis
        state={{ status: "failed", message: "It did not work." }}
        onAnalyse={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("It did not work.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  it.each<AnalysisState>([
    { status: "idle" },
    { status: "reading" },
    { status: "ready", sections },
    {
      status: "failed",
      message: "Kiezpigeon could not read this page's text.",
    },
  ])("uses no provider words in the $status state", (state) => {
    const { container } = render(
      <ListingAnalysis state={state} onAnalyse={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(NEUTRAL);
  });
});

describe("ListingDetected analysis", () => {
  it("shows no analysis on typed facts", () => {
    render(
      <ListingDetected
        profile={coupleWithDog}
        siteName="Example"
        listing={sparseListing}
        onEditFacts={vi.fn()}
        analysis={{ state: { status: "idle" }, onAnalyse: vi.fn() }}
        onWrite={vi.fn()}
      />,
    );
    expect(screen.queryByText("Analyse this listing")).toBeNull();
  });
});

describe("ListingFlow analysis", () => {
  let toTab: MockInstance<() => Promise<unknown>>;
  let toWorker: MockInstance<(message: unknown) => Promise<unknown>>;
  beforeEach(() => {
    fakeBrowser.reset();
    toTab = vi.spyOn(browser.tabs, "sendMessage");
    toTab.mockResolvedValue({
      ok: true,
      value: { kind: "text", text: "Page text." },
    });
    toWorker = vi.spyOn(browser.runtime, "sendMessage");
  });

  it("keeps the result for the listing it was asked for", async () => {
    let answer: (value: unknown) => void = () => undefined;
    toWorker.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const listingB = { ...kreuzbergListing, url: "https://example.test/b" };
    const flow = (listing: typeof kreuzbergListing) => (
      <ListingFlow
        ownTab={7}
        profile={coupleWithDog}
        siteName="ImmoScout24"
        listing={listing}
      />
    );
    const { rerender } = render(flow(kreuzbergListing));
    fireEvent.click(
      screen.getByRole("button", { name: "Analyse this listing" }),
    );
    await screen.findByRole("status");

    rerender(flow(listingB));
    answer({ ok: true, value: { kind: "analysis", sections } });
    await vi.waitFor(() => {
      expect(toWorker).toHaveBeenCalledOnce();
    });
    // B is idle even after A's answer has landed.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.getByRole("button", { name: "Analyse this listing" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { name: "Price", level: 3 }),
    ).toBeNull();

    rerender(flow(kreuzbergListing));
    expect(
      await screen.findByRole("heading", { name: "Price", level: 3 }),
    ).toBeDefined();
  });
});
