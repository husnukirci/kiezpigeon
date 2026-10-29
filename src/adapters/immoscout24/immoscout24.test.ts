// Fixture tests (PLAN.md section 5): each saved, scrubbed page and the
// exact Listing the adapter returns for it.
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test-support/fixtures";
import { immoscout24 } from "./immoscout24";

const URL = "https://www.immobilienscout24.de/expose/100000003";

describe("immoscout24.matches", () => {
  it("matches exposé pages only", () => {
    expect(immoscout24.matches(URL)).toBe(true);
    expect(immoscout24.matches(`${URL}?referrer=RESULT_LIST`)).toBe(true);
    expect(
      immoscout24.matches(
        "https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten",
      ),
    ).toBe(false);
    expect(
      immoscout24.matches("https://www.example.org/expose/100000003"),
    ).toBe(false);
  });
});

describe("immoscout24.readListing", () => {
  it("reads a listing with missing fields and names what it lacks", () => {
    const listing = immoscout24.readListing(
      loadFixture("immoscout24", "listing-missing-fields.html"),
      URL,
    );
    expect(listing).toEqual({
      url: URL,
      title: "Teilmöbliert 2 Zimmer nähe U Bahn Osloer Straße",
      address: "Musterweg 5, Reinickendorf (Ortsteil), 13401 Berlin",
      district: "Reinickendorf",
      kaltmieteCents: 75000,
      nebenkostenCents: 20000,
      warmmieteCents: 95000,
      areaM2: 44,
      rooms: 2,
      // Near the end of the page: proves the whole fixture parsed.
      contactPerson: { firstName: "Lena", lastName: "Beispiel" },
      features: [],
      missing: [
        "floor",
        "availableFrom",
        "yearBuilt",
        "petPolicy",
        "wbsRequired",
      ],
    });
  });

  it("reads a complete listing, with a company as the contact", () => {
    const listing = immoscout24.readListing(
      loadFixture("immoscout24", "listing-complete.html"),
      URL,
    );
    expect(listing).toEqual({
      url: URL,
      title: "Singlewohnung!",
      address: "Musterallee 9, Reinickendorf (Ortsteil), 13401 Berlin",
      district: "Reinickendorf",
      kaltmieteCents: 102829,
      nebenkostenCents: 12000,
      warmmieteCents: 121829,
      areaM2: 51.44,
      rooms: 1,
      floor: 1,
      availableFrom: "2027-02-01",
      yearBuilt: 2016,
      petPolicy: "allowed",
      features: ["Balkon", "Keller", "Personenaufzug", "Stufenloser Zugang"],
      // Neither saved page showed a WBS field; a company gets no name.
      missing: ["wbsRequired", "contactPerson"],
    });
  });

  it("says a search results page is not a listing", () => {
    const page = loadFixture("immoscout24", "search-results.html");
    // The two result cards made it through the parse.
    expect(page.querySelectorAll(".listing-card")).toHaveLength(2);
    expect(immoscout24.readListing(page, URL)).toBeUndefined();
  });

  it("reads a WBS row by its label", () => {
    // Invented markup in the shape of the page's criteria rows: no saved
    // page had a WBS field (docs/ai-workflow.md, Phase 3).
    const page = (value: string): Document =>
      new DOMParser().parseFromString(
        `<h1 data-qa="expose-title">Wohnung</h1>
         <dl><dt>Wohnberechtigungsschein</dt><dd>${value}</dd></dl>`,
        "text/html",
      );
    expect(
      immoscout24.readListing(page("erforderlich"), URL)?.wbsRequired,
    ).toBe(true);
    expect(
      immoscout24.readListing(page("nicht erforderlich"), URL)?.wbsRequired,
    ).toBe(false);
  });
});
