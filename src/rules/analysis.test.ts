import { describe, expect, it } from "vitest";
import {
  kreuzbergListing,
  sparseListing,
} from "../../test-support/sample-profiles";
import { analyseListing, centsPerM2 } from "./analysis";
import { NO_HINTS } from "./rentalHints";
import type { Listing, RentalHints } from "./types";

const NO_KIND =
  "The page names no special form of rental: no Untermiete, Zwischenmiete, WG, möbliert, Genossenschaft or WBS.";

/** A Kaltmiete that is exactly `centsPerSquareMetre` on the sample's 62 m². */
const at = (centsPerSquareMetre: number): Listing => ({
  ...kreuzbergListing,
  kaltmieteCents: centsPerSquareMetre * 62,
});

describe("centsPerM2", () => {
  it("rounds to whole cents and gives nothing for no area", () => {
    expect(centsPerM2(118000, 62)).toBe(1903);
    expect(centsPerM2(118000, 0)).toBeUndefined();
  });
});

describe("analyseListing: kind", () => {
  it("says so when the description could not be read", () => {
    expect(
      analyseListing({ ...kreuzbergListing, hints: undefined }).kind,
    ).toEqual({
      id: "kind",
      status: "unknown",
      text: "I could not read this page's description.",
    });
  });

  it("names no special form of rental on plain text", () => {
    const plain = {
      ...kreuzbergListing,
      flatType: undefined,
      offeredBy: undefined,
    };
    expect(analyseListing(plain).kind).toEqual({
      id: "kind",
      status: "info",
      text: NO_KIND,
    });
  });

  it("leads with the flat type and who offers it", () => {
    expect(analyseListing(kreuzbergListing).kind.text).toBe(
      `Etagenwohnung, offered by a company. ${NO_KIND}`,
    );
    // Without a flat type the offerer opens the line, as a sentence.
    expect(
      analyseListing({
        ...kreuzbergListing,
        flatType: undefined,
        offeredBy: "private",
      }).kind.text,
    ).toBe(`Offered privately. ${NO_KIND}`);
  });

  it("lists the forms the page names, in a fixed order", () => {
    const some: RentalHints = {
      ...NO_HINTS,
      furnished: true,
      interim: true,
      fixedTerm: true,
    };
    expect(
      analyseListing({ ...kreuzbergListing, offeredBy: "private", hints: some })
        .kind.text,
    ).toBe(
      "Etagenwohnung, Möbliert, Zwischenmiete, befristet, offered privately.",
    );
    const all = Object.fromEntries(
      Object.keys(NO_HINTS).map((flag) => [flag, true]),
    ) as unknown as RentalHints;
    expect(
      analyseListing({
        ...kreuzbergListing,
        flatType: undefined,
        offeredBy: undefined,
        // No WBS row on this page, so the text's mention counts.
        wbsRequired: undefined,
        hints: all,
      }).kind.text,
    ).toBe(
      "Erstbezug, Möbliert, WG-Zimmer, Untermiete, Zwischenmiete, befristet, Genossenschaft, WBS required, Staffelmiete, Indexmiete.",
    );
    expect(
      analyseListing({
        ...kreuzbergListing,
        flatType: undefined,
        offeredBy: undefined,
        wbsRequired: true,
      }).kind.text,
    ).toBe("WBS required.");
    // The page's own WBS row outranks a scanned mention of WBS.
    expect(
      analyseListing({
        ...kreuzbergListing,
        flatType: undefined,
        offeredBy: undefined,
        wbsRequired: false,
        hints: { ...NO_HINTS, wbs: true },
      }).kind.text,
    ).toBe(NO_KIND);
  });
});

describe("analyseListing: price", () => {
  it("has no figure without Kaltmiete or size", () => {
    expect(
      analyseListing({ ...kreuzbergListing, areaM2: undefined }).price,
    ).toEqual({
      id: "price",
      status: "unknown",
      text: "Kaltmiete or size not shown, so no price per m².",
    });
  });

  it("shows the figure alone on a page without a comparison", () => {
    expect(
      analyseListing({ ...kreuzbergListing, priceComparison: undefined }).price,
    ).toEqual({
      id: "price",
      status: "info",
      text: "Kaltmiete 19,03 €/m². This page shows no comparison.",
    });
  });

  it("places the figure against the page's band", () => {
    expect(analyseListing(kreuzbergListing).price).toEqual({
      id: "price",
      status: "info",
      text: "Kaltmiete 19,03 €/m². Nearby offers mostly run 14,00 to 21,00 €/m² (500 flats within 1000 m on this site): within the usual range.",
    });
  });

  it("grades the verdict at the band's edges", () => {
    const verdict = (cents: number) => analyseListing(at(cents)).price;
    expect(verdict(2100)).toMatchObject({ status: "info" });
    expect(verdict(2100).text).toContain(": within the usual range.");
    expect(verdict(2200)).toMatchObject({ status: "info" });
    expect(verdict(2200).text).toContain(": above the usual range.");
    // Exactly a quarter over the top is already "well above".
    expect(verdict(2625)).toMatchObject({ status: "note" });
    expect(verdict(2625).text).toContain(": well above the usual range.");
    expect(verdict(1300).text).toContain(": below the usual range.");
    expect(verdict(1050)).toMatchObject({ status: "note" });
    expect(verdict(1050).text).toContain(": well below the usual range.");
  });
});

describe("analyseListing: greeting", () => {
  it("shows how the letter will greet a named contact", () => {
    expect(analyseListing(kreuzbergListing).greeting).toEqual({
      id: "greeting",
      status: "info",
      text: 'The letter will greet "Sehr geehrte Frau Weber".',
    });
    expect(analyseListing(sparseListing).greeting).toBeUndefined();
  });
});

describe("analyseListing: worth a second look", () => {
  it("finds nothing on the sample listing", () => {
    expect(analyseListing(kreuzbergListing).notes).toEqual([]);
  });

  it("lists every note in a fixed order, money first", () => {
    const odd: Listing = {
      ...at(1050),
      kautionCents: 450000,
      nebenkostenCents: 70000,
      hints: {
        ...NO_HINTS,
        commission: true,
        noViewing: true,
        paymentFirst: true,
        abroad: true,
      },
    };
    // 1050 €/m² × 62 m² = 65.100 €.
    expect(analyseListing(odd).notes).toEqual([
      {
        id: "deposit",
        status: "note",
        text: "Kaution is 4.500 €, more than three Kaltmieten (1.953 €). Three is the legal maximum (§ 551 BGB).",
      },
      {
        id: "utilities",
        status: "note",
        text: "Nebenkosten are 700 €, over half the Kaltmiete. Ask what they include.",
      },
      {
        id: "commission",
        status: "note",
        text: "The text mentions a Provision. A tenant who did not hire the agent pays none since 2015 (Bestellerprinzip).",
      },
      {
        id: "noViewing",
        status: "note",
        text: "The text says no viewing is possible. Seeing the flat before any payment is normal.",
      },
      {
        id: "paymentFirst",
        status: "note",
        text: "The text asks for a payment or deposit before a viewing.",
      },
      {
        id: "abroad",
        status: "note",
        text: "The text says the landlord is abroad.",
      },
      {
        id: "cheap",
        status: "note",
        text: "Much cheaper than nearby offers. Worth asking why.",
      },
    ]);
  });

  it("does not question the Kaution of a Genossenschaft, whose row holds the shares", () => {
    const cooperative: Listing = {
      ...kreuzbergListing,
      kautionCents: 450000,
      hints: { ...NO_HINTS, cooperative: true },
    };
    expect(analyseListing(cooperative).notes).toEqual([]);
    expect(
      analyseListing({ ...kreuzbergListing, kautionCents: 450000 }).notes.map(
        (n) => n.id,
      ),
    ).toEqual(["deposit"]);
  });
});
