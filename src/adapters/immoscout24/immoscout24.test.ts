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
      missing: [],
    });
  });
});
