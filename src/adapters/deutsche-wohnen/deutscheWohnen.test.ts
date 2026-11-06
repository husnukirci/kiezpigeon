// Fixture tests (PLAN.md section 5): each saved, scrubbed page and the
// exact Listing the adapter returns for it.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import { deutscheWohnen } from "./deutscheWohnen";

const SEARCH = "https://www.deutsche-wohnen.com/mieten/zuhause-mieten";
const URL =
  "https://www.deutsche-wohnen.com/mieten/mietangebote/ruhige-3-zimmer-wohnung-89-2000000001";

function complete(): Document {
  return loadFixture("deutsche-wohnen", "listing-complete.html");
}

/** The element beside a row's label, in the page's detail lists. */
function rowValue(page: Document, label: string): Element {
  const value = Array.from(page.querySelectorAll("li > .name")).find(
    (name) => name.textContent.trim() === label,
  )?.nextElementSibling;
  if (!value) throw new Error(`no ${label} row in the fixture`);
  return value;
}

describe("deutscheWohnen.matches", () => {
  it("matches listing pages only", () => {
    expect(deutscheWohnen.matches(URL)).toBe(true);
    expect(deutscheWohnen.matches(`${URL}?em_src=x`)).toBe(true);
    expect(deutscheWohnen.matches(`${URL}#map-id-2000000001`)).toBe(true);
  });

  it("refuses the search pages and look-alike hosts", () => {
    for (const url of [
      SEARCH,
      "https://www.deutsche-wohnen.com/mieten/mietangebote",
      "https://www.deutsche-wohnen.com/mieten/mietangebote/",
      "https://www.deutsche-wohnen.com/mieten/mietangebote?city=Berlin",
      "https://www.deutsche-wohnen.com.flats.example/mieten/mietangebote/x-89-1",
      "https://flats.example/www.deutsche-wohnen.com/mieten/mietangebote/x-89-1",
      "http://www.deutsche-wohnen.com/mieten/mietangebote/x-89-1",
    ]) {
      expect(deutscheWohnen.matches(url)).toBe(false);
    }
  });
});

describe("deutscheWohnen.readListing", () => {
  it("reads every field the page shows and names what it does not", () => {
    expect(deutscheWohnen.readListing(complete(), URL)).toEqual({
      url: URL,
      title: "Ruhige 3-Zimmer-Wohnung mit Aufzug",
      address: "Beispielweg 7 - 10999 Berlin OT Kreuzberg",
      district: "Kreuzberg",
      kaltmieteCents: 87654,
      nebenkostenCents: 18000,
      warmmieteCents: 115654,
      areaM2: 72.3,
      rooms: 3,
      floor: 4,
      availability: { kind: "date", date: "2027-04-01" },
      yearBuilt: 1928,
      contactPerson: { salutation: "Herr", lastName: "Sommer" },
      features: [
        "Aufzug",
        "Balkon",
        "Ausrichtung Freisitz: West",
        "Spüle",
        "E-Herd",
        "Boden in Holzoptik",
        "Zentralheizung",
        "Gas",
        "Wärmeschutzverglasung",
        "Mieterkeller",
        "Fahrradabstellraum",
        "Gegensprechanlage",
        "Waschmaschinenanschluss",
        "Spielplatz",
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
    const listing = deutscheWohnen.readListing(
      loadFixture("deutsche-wohnen", "listing-missing-fields.html"),
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
    expect(listing?.kaltmieteCents).toBe(87654);
  });

  it("reads the availability figure when the row is gone", () => {
    const page = complete();
    rowValue(page, "Verfügbar ab").parentElement?.remove();
    expect(deutscheWohnen.readListing(page, URL)?.availability).toEqual({
      kind: "date",
      date: "2027-04-01",
    });
  });

  it("names the title as missing when the site prints that it has none", () => {
    const page = complete();
    const title = page.querySelector(".real-estate-hero .headline");
    if (!title) throw new Error("no title in the fixture");
    title.textContent = "Kein Titel";
    const listing = deutscheWohnen.readListing(page, URL);
    expect(listing?.title).toBeUndefined();
    expect(listing?.missing).toContain("title");
  });

  it("does not guess a floor that spans two", () => {
    const page = complete();
    rowValue(page, "Geschoss").textContent = "Erd-/Obergeschoß";
    const listing = deutscheWohnen.readListing(page, URL);
    expect(listing?.floor).toBeUndefined();
    expect(listing?.missing).toContain("floor");
  });

  it("does not take a parking space for a flat", () => {
    const page = complete();
    rowValue(page, "Typ").textContent = "Parken";
    expect(deutscheWohnen.readListing(page, URL)).toBeUndefined();
  });

  it("does not take a search page for a listing", () => {
    expect(
      deutscheWohnen.readListing(
        loadFixture("deutsche-wohnen", "search-results.html"),
        SEARCH,
      ),
    ).toBeUndefined();
  });
});

describe("deutscheWohnen.isReady", () => {
  it("waits for a title the site draws late, on a page with no h1", () => {
    const page = complete();
    expect(page.querySelector("h1")).toBeNull();
    expect(deutscheWohnen.isReady?.(page)).toBe(true);
    page.querySelector(".real-estate-hero")?.remove();
    expect(deutscheWohnen.isReady?.(page)).toBe(false);
  });

  it("waits for rows that come after the title", () => {
    const page = complete();
    for (const row of page.querySelectorAll("li > .name")) row.remove();
    expect(deutscheWohnen.isReady?.(page)).toBe(false);
  });

  it("does not wait on a listing frame with rows but no Kaltmiete", () => {
    const page = complete();
    rowValue(page, "Kaltmiete").parentElement?.remove();
    expect(deutscheWohnen.isReady?.(page)).toBe(true);
  });

  it("does not wait on a page that is no listing", () => {
    expect(
      deutscheWohnen.isReady?.(
        loadFixture("deutsche-wohnen", "search-results.html"),
      ),
    ).toBe(true);
  });
});

describe("deutscheWohnen.readContactForm", () => {
  it("is empty until the overlay is open", () => {
    const closed = complete();
    expect(deutscheWohnen.contactForm(closed)).toBeUndefined();
    expect(deutscheWohnen.readContactForm(closed)).toEqual([]);
  });

  it("reads the open form", () => {
    const open = loadFixture("deutsche-wohnen", "contact-form.html");
    expect(deutscheWohnen.contactForm(open)).toBeDefined();
    expect(
      deutscheWohnen.readContactForm(open).map((field) => field.name),
    ).toEqual([
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

  it("reads the dropdowns when the site set their widgets up twice", () => {
    const page = loadFixture("deutsche-wohnen", "contact-form.html");
    for (const own of page.querySelectorAll(
      ".overlay-contact-form.active select + .ss-main",
    )) {
      const second = own.cloneNode(true) as Element;
      second.setAttribute("data-id", `${own.getAttribute("data-id") ?? ""}-2`);
      own.after(second);
      own.setAttribute("style", "display: none;");
    }
    const visible = deutscheWohnen
      .readContactForm(page)
      .filter((field) => field.visible)
      .map((field) => field.name);
    expect(visible).toContain("einkommensart");
    expect(visible).toContain("monatliches_nettoeinkommen");
  });

  it("takes the open overlay when the site drew two", () => {
    const page = loadFixture("deutsche-wohnen", "contact-form.html");
    const open = page.querySelector(".overlay-contact-form.active");
    if (!open) throw new Error("no open overlay in the fixture");
    const closed = open.cloneNode(true) as Element;
    closed.classList.remove("active");
    open.before(closed);
    expect(deutscheWohnen.contactForm(page)?.closest(".active")).toBe(open);
  });
});
