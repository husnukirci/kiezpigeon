import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

  it.each([
    [
      "https://www.immobilienscout24.de/Suche/de/berlin/wohnung-mieten",
      "This ImmoScout24 page is not a listing. Open a listing to start.",
    ],
    [
      "https://www.immobilienscout24.de/expose/100000009",
      "Reload this tab so Kiezpigeon can read it.",
    ],
  ])("says why %s is not read, and offers no fallback", async (url, reason) => {
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(
      new Error("Receiving end does not exist."),
    );
    const get = vi.spyOn(browser.tabs, "get") as unknown as MockInstance<
      () => Promise<Browser.tabs.Tab>
    >;
    get.mockResolvedValue({ id: 7, url } as Browser.tabs.Tab);
    render(<Home profile={coupleWithDog} />);
    expect(await screen.findByText(reason)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Use this page" })).toBeNull();
  });

  it("reads the contact form again on the letter screen when its tab loads another page", async () => {
    window.history.replaceState(null, "", "?tabId=7");
    let formReads = 0;
    vi.mocked(browser.tabs.sendMessage).mockImplementation(((
      _tab: number,
      message: { type: string },
    ) => {
      if (message.type === "getContactForm") {
        formReads += 1;
        return Promise.resolve({
          ok: true,
          value:
            formReads === 1
              ? {
                  kind: "form",
                  fields: [
                    {
                      key: "name:firstName",
                      type: "text",
                      visible: true,
                      disabled: false,
                    },
                  ],
                }
              : { kind: "no_form" },
        });
      }
      return Promise.resolve({
        ok: true,
        value: {
          kind: "listing",
          siteName: "ImmoScout24",
          listing: kreuzbergListing,
        },
      });
    }) as never);
    try {
      render(<Home profile={coupleWithDog} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Write my letter" }),
      );
      await screen.findByRole("heading", { name: "Letter ready" });
      await waitFor(() => {
        expect(formReads).toBe(1);
      });
      expect(
        screen.queryByText(/Open the contact form on the listing first/),
      ).toBeNull();

      await fakeBrowser.tabs.onUpdated.trigger(7, { status: "complete" }, {
        id: 7,
      } as Browser.tabs.Tab);

      expect(
        await screen.findByText(/Open the contact form on the listing first/),
      ).toBeDefined();
      expect(formReads).toBe(2);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("starts over on an unknown site when its tab loads another page", async () => {
    window.history.replaceState(null, "", "?tabId=7");
    // No content script answers: the tab is not a listing Kiezpigeon knows.
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(
      new Error("Receiving end does not exist."),
    );
    Object.defineProperty(browser, "scripting", {
      value: {
        executeScript: () =>
          Promise.resolve([{ frameId: 0, result: "https://flats.example/1" }]),
      },
      configurable: true,
    });
    try {
      render(<Home profile={coupleWithDog} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Use this page" }),
      );
      fireEvent.change(await screen.findByLabelText("Kaltmiete in €"), {
        target: { value: "980" },
      });

      await fakeBrowser.tabs.onUpdated.trigger(7, { status: "complete" }, {
        id: 7,
      } as Browser.tabs.Tab);
      // The facts belonged to the page that was there before.
      expect(
        await screen.findByRole("button", { name: "Use this page" }),
      ).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Use this page" }));
      expect(await screen.findByLabelText("Kaltmiete in €")).toHaveProperty(
        "value",
        "",
      );
    } finally {
      Reflect.deleteProperty(browser, "scripting");
      window.history.replaceState(null, "", "/");
    }
  });
});
