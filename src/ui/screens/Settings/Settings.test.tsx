import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { coupleWithDog } from "../../../../test-support/sample-profiles";
import { exportData } from "../../../rules/profile";
import { read, resetForTests, write } from "../../../storage/storage";
import { Settings } from "./Settings";

beforeEach(async () => {
  fakeBrowser.reset();
  resetForTests();
  await write("profile", coupleWithDog);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function chooseFile(text: string): void {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no import input");
  const file = new File([text], "kiezpigeon.json", {
    type: "application/json",
  });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("Settings", () => {
  it("saves a valid change and holds back an invalid one", async () => {
    render(<Settings profile={coupleWithDog} onClose={vi.fn()} />);
    const [firstName] = screen.getAllByLabelText("First name");
    fireEvent.change(firstName as HTMLElement, {
      target: { value: "Marlene" },
    });
    await waitFor(async () => {
      const stored = await read("profile");
      expect(stored.ok && stored.value?.applicants[0]?.firstName).toBe(
        "Marlene",
      );
    });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "" } });
    expect(
      screen.getByText("Add an email so landlords can reply"),
    ).toBeDefined();
    expect(screen.getByText(/Not saved yet/)).toBeDefined();
    const stored = await read("profile");
    expect(stored.ok && stored.value?.contact.email).toBe(
      coupleWithDog.contact.email,
    );
  });

  it("deletes everything after a confirm", async () => {
    const onClose = vi.fn();
    render(<Settings profile={coupleWithDog} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete all data" }));
    expect(await fakeBrowser.storage.local.get(null)).not.toEqual({});
    fireEvent.click(screen.getByRole("button", { name: "Delete everything" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });

  it("names every problem of a bad import and changes nothing", async () => {
    render(<Settings profile={coupleWithDog} onClose={vi.fn()} />);
    chooseFile(
      JSON.stringify({ kiezpigeon: 1, exportedAt: "x", applications: [] }),
    );
    expect(await screen.findByText(/can't be imported/)).toBeDefined();
    expect(
      screen.getByText("exportedAt: must be a date and time"),
    ).toBeDefined();
    expect(screen.getByText("profile: must be an object")).toBeDefined();
    expect(await read("profile")).toEqual({ ok: true, value: coupleWithDog });
  });

  it("replaces the data with an import after a confirm", async () => {
    const onClose = vi.fn();
    render(<Settings profile={undefined} onClose={onClose} />);
    const changed = { ...coupleWithDog, hasWbs: true };
    chooseFile(
      JSON.stringify(exportData(changed, [], "2027-01-01T00:00:00.000Z")),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Replace my data" }),
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(await read("profile")).toEqual({ ok: true, value: changed });
  });

  it("exports a JSON file with the profile and no API key", async () => {
    await fakeBrowser.storage.local.set({ apiKey: "FAKE-KEY" });
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<Settings profile={coupleWithDog} onClose={vi.fn()} />);
    const exportButton = screen.getByRole("button", { name: "Export" });
    // Applications load first; the button exports once they are read.
    await waitFor(() => {
      fireEvent.click(exportButton);
      expect(click).toHaveBeenCalled();
    });
    const text = await (blobs[0] as Blob).text();
    expect(JSON.parse(text)).toMatchObject({
      kiezpigeon: 2,
      profile: coupleWithDog,
    });
    expect(text).not.toContain("FAKE-KEY");
  });
});
