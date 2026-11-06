// Fixture tests (PLAN.md section 5): each saved, scrubbed page and the
// exact Listing the adapter returns for it.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import { vonovia } from "./vonovia";

const URL =
  "https://www.vonovia.de/zuhause-finden/immobilien/helle-3-zimmer-wohnung-82-1000000001";

describe("vonovia.matches", () => {
  it("matches listing pages only", () => {
    expect(vonovia.matches(URL)).toBe(true);
    expect(vonovia.matches(`${URL}?em_src=x`)).toBe(true);
    expect(vonovia.matches(`${URL}#map-id-1000000001`)).toBe(true);
    expect(
      vonovia.matches("https://www.vonovia.de/zuhause-finden/immobilien"),
    ).toBe(false);
    expect(
      vonovia.matches("https://www.vonovia.de/zuhause-finden/immobilien/"),
    ).toBe(false);
    expect(vonovia.matches("https://www.vonovia.de/zuhause-finden")).toBe(
      false,
    );
    expect(
      vonovia.matches(
        "https://www.vonovia.de.flats.example/zuhause-finden/immobilien/x-82-1",
      ),
    ).toBe(false);
  });
});

describe("vonovia.readListing", () => {
  it("reads every field the page shows and names what it does not", () => {
    expect(
      vonovia.readListing(loadFixture("vonovia", "listing-complete.html"), URL),
    ).toEqual({
      url: URL,
      title: "Helle 3-Zimmer-Wohnung mit Balkon",
      address: "Musterstr. 12 - 10999 Berlin OT Kreuzberg",
      district: "Kreuzberg",
      kaltmieteCents: 98765,
      nebenkostenCents: 15000,
      warmmieteCents: 123765,
      areaM2: 78.4,
      rooms: 3,
      floor: 2,
      availability: { kind: "date", date: "2027-03-01" },
      yearBuilt: 1912,
      contactPerson: { salutation: "Frau", lastName: "Weber" },
      features: [
        "Balkon",
        "Bad mit Fenster",
        "Einbauküche",
        "Spüle",
        "E-Herd",
        "Holzdielen",
        "tapeziert",
        "Zentralheizung",
        "Gas",
        "Isolierverglasung",
        "Mieterkeller",
        "Gegensprechanlage",
        "Waschmaschinenanschluss",
        "Mehrfamilienhaus",
        "Badewanne eingemauert",
      ],
      missing: [
        "petPolicy",
        "wbsRequired",
        "flatType",
        "kautionCents",
        "offeredBy",
        "priceComparison",
        "hints",
      ],
    });
  });

  it("names what a sparse listing lacks and greets no company", () => {
    const listing = vonovia.readListing(
      loadFixture("vonovia", "listing-missing-fields.html"),
      URL,
    );
    expect(listing?.missing).toEqual([
      "district",
      "nebenkostenCents",
      "floor",
      "availability",
      "yearBuilt",
      "petPolicy",
      "wbsRequired",
      "contactPerson",
      "flatType",
      "kautionCents",
      "offeredBy",
      "priceComparison",
      "hints",
    ]);
    expect(listing?.address).toBe("10999 Berlin");
    expect(listing?.kaltmieteCents).toBe(98765);
  });

  it("does not take a parking space for a flat", () => {
    const page = loadFixture("vonovia", "listing-complete.html");
    const type = Array.from(page.querySelectorAll("li > .name")).find(
      (name) => name.textContent.trim() === "Typ",
    )?.nextElementSibling;
    if (!type) throw new Error("no Typ row in the fixture");
    type.textContent = "Parken";
    expect(vonovia.readListing(page, URL)).toBeUndefined();
  });

  it("does not take a search page for a listing", () => {
    expect(
      vonovia.readListing(
        loadFixture("vonovia", "search-results.html"),
        "https://www.vonovia.de/zuhause-finden",
      ),
    ).toBeUndefined();
  });
});

describe("vonovia.isReady", () => {
  it("waits for the title on a listing the site is still drawing", () => {
    const page = loadFixture("vonovia", "listing-complete.html");
    expect(vonovia.isReady?.(page)).toBe(true);
    page.querySelector("h1")?.remove();
    expect(vonovia.isReady?.(page)).toBe(false);
  });

  it("does not wait on a page that is no listing", () => {
    expect(
      vonovia.isReady?.(loadFixture("vonovia", "search-results.html")),
    ).toBe(true);
  });
});

describe("vonovia.readContactForm", () => {
  it("is empty until the overlay is open", () => {
    const closed = loadFixture("vonovia", "listing-complete.html");
    expect(vonovia.contactForm(closed)).toBeUndefined();
    expect(vonovia.readContactForm(closed)).toEqual([]);
  });

  it("reads the open form", () => {
    const open = loadFixture("vonovia", "contact-form.html");
    expect(vonovia.contactForm(open)).toBeDefined();
    expect(vonovia.readContactForm(open).map((field) => field.name)).toEqual([
      "wrkID",
      "firstname",
      "surename",
      "telephone",
      "email",
      "einkommensart",
      "monatliches_nettoeinkommen",
      "message",
    ]);
  });
});
