import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { Application } from "../../../rules/types";
import { read, resetForTests, write } from "../../../storage/storage";
import { Tracker } from "./Tracker";

const sentAt = "2027-02-01T09:30:00.000Z";

function app(
  id: string,
  status: Application["status"],
  listingTitle: string,
): Application {
  return {
    id,
    listingUrl: `https://www.immobilienscout24.de/expose/${id.slice(4)}`,
    listingTitle,
    district: "Kreuzberg",
    warmmieteCents: 140000,
    letter: "Sehr geehrte Frau Weber, ...",
    status,
    sentAt,
    statusChangedAt: sentAt,
  };
}

const three = [
  app("app_100000001", "sent", "Altbau mit Balkon"),
  app("app_100000002", "viewing", "Dachgeschoss am Park"),
  app("app_100000003", "closed", "Neubau an der Spree"),
];

beforeEach(async () => {
  fakeBrowser.reset();
  resetForTests();
  await write("applications", three);
});
afterEach(cleanup);

/** A stat tile's number: the stat-sized text above its label. */
function tile(label: string): string | null | undefined {
  const values = screen
    .getAllByText(label, { selector: "p" })
    .map((p) => p.previousElementSibling)
    .filter((above) => above?.classList.contains("type-stat"));
  expect(values).toHaveLength(1);
  return values[0]?.textContent;
}

function rowTitles(): string[] {
  const list = screen.queryByRole("list", { name: "Applications" });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.querySelector("p")?.textContent ?? "");
}

describe("Tracker", () => {
  it("counts three applications across statuses and filters them", async () => {
    render(<Tracker onClose={vi.fn()} />);
    await screen.findByText("Altbau mit Balkon");

    expect(tile("Sent")).toBe("3");
    expect(tile("Viewings")).toBe("1");
    expect(tile("Waiting")).toBe("1");
    expect(rowTitles()).toHaveLength(3);

    const filters = screen.getByRole("group", { name: "Filter" });
    fireEvent.click(within(filters).getByRole("button", { name: "Viewing" }));
    expect(rowTitles()).toEqual(["Dachgeschoss am Park"]);
    expect(
      within(filters)
        .getByRole("button", { name: "Viewing" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(filters).getByRole("button", { name: "Closed" }));
    expect(rowTitles()).toEqual(["Neubau an der Spree"]);
    fireEvent.click(within(filters).getByRole("button", { name: "All" }));
    expect(rowTitles()).toHaveLength(3);
  });

  it("names each status in words and links the listing", async () => {
    render(<Tracker onClose={vi.fn()} />);
    const row = (await screen.findByText("Neubau an der Spree")).closest("li");
    if (!row) throw new Error("no row");
    expect(within(row).getByText("Closed")).toBeDefined();
    expect(within(row).getByText(/Kreuzberg · 1\.400 € Warmmiete · sent/));
    const link = within(row).getByRole("link", { name: "Open listing" });
    expect(link.getAttribute("href")).toBe(
      "https://www.immobilienscout24.de/expose/100000003",
    );
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("changes a row's status and stores when it changed", async () => {
    render(<Tracker onClose={vi.fn()} />);
    const row = (await screen.findByText("Altbau mit Balkon")).closest("li");
    if (!row) throw new Error("no row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Mark as viewing" }),
    );
    await waitFor(() => {
      expect(tile("Viewings")).toBe("2");
    });
    const stored = await read("applications");
    const changed = stored.ok ? stored.value?.[0] : undefined;
    expect(changed?.status).toBe("viewing");
    expect(changed?.statusChangedAt).not.toBe(sentAt);
  });

  it("starts empty with zeros and the pigeon's first tip", async () => {
    await write("applications", []);
    render(<Tracker onClose={vi.fn()} />);
    expect(await screen.findByText(/Nothing here yet/)).toBeDefined();
    expect(tile("Sent")).toBe("0");
    expect(rowTitles()).toEqual([]);
  });
});
