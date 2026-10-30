import { describe, expect, it } from "vitest";
import {
  EMPTY_FACTS,
  featuresFromText,
  listingFromFacts,
  type ListingFacts,
} from "./typedListing";

const URL = "https://flats.example/wohnung/17";

function facts(overrides: Partial<ListingFacts>): ListingFacts {
  return { ...EMPTY_FACTS, ...overrides };
}

describe("featuresFromText", () => {
  it("splits on commas, semicolons and new lines and trims each", () => {
    expect(featuresFromText(" Balkon, Altbau;Einbauküche\n Aufzug ")).toEqual([
      "Balkon",
      "Altbau",
      "Einbauküche",
      "Aufzug",
    ]);
  });

  it("drops empty parts and repeats, keeping the first spelling", () => {
    expect(featuresFromText("Balkon,, balkon ,Altbau,\n")).toEqual([
      "Balkon",
      "Altbau",
    ]);
  });

  it("reads a blank field as no features", () => {
    expect(featuresFromText("   ")).toEqual([]);
  });
});

describe("listingFromFacts", () => {
  it("builds the listing from what the user typed, nothing more", () => {
    const result = listingFromFacts(
      facts({
        title: " 2 Zimmer am Park ",
        kaltmiete: "1.180",
        warmmiete: "1.420,50",
        salutation: "Frau",
        contactLastName: " Okafor ",
        features: "Balkon, Altbau",
      }),
      URL,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        url: URL,
        title: "2 Zimmer am Park",
        kaltmieteCents: 118000,
        warmmieteCents: 142050,
        contactPerson: { salutation: "Frau", lastName: "Okafor" },
        features: ["Balkon", "Altbau"],
        missing: [
          "address",
          "district",
          "nebenkostenCents",
          "areaM2",
          "rooms",
          "floor",
          "availability",
          "yearBuilt",
          "petPolicy",
          "wbsRequired",
        ],
      },
    });
  });

  it("names every fact as missing when the user typed nothing", () => {
    const result = listingFromFacts(EMPTY_FACTS, URL);
    expect(result.ok && result.value).toEqual({
      url: URL,
      features: [],
      missing: [
        "title",
        "address",
        "district",
        "kaltmieteCents",
        "nebenkostenCents",
        "warmmieteCents",
        "areaM2",
        "rooms",
        "floor",
        "availability",
        "yearBuilt",
        "petPolicy",
        "wbsRequired",
        "contactPerson",
      ],
    });
  });

  it("keeps a last name without a salutation", () => {
    const result = listingFromFacts(facts({ contactLastName: "Brandt" }), URL);
    expect(result.ok && result.value.contactPerson).toEqual({
      lastName: "Brandt",
    });
  });

  it("asks for the last name when only a salutation was chosen", () => {
    expect(listingFromFacts(facts({ salutation: "Herr" }), URL)).toEqual({
      ok: false,
      problems: [
        {
          field: "contactLastName",
          message:
            "Add the contact person's last name, or set the salutation to none",
        },
      ],
    });
  });

  it("names each rent the user wrote in a form it cannot read", () => {
    expect(
      listingFromFacts(facts({ kaltmiete: "abc", warmmiete: "12,345" }), URL),
    ).toEqual({
      ok: false,
      problems: [
        {
          field: "kaltmiete",
          message: "Write the amount like 2.600 or 2.600,50",
        },
        {
          field: "warmmiete",
          message: "Write the amount like 2.600 or 2.600,50",
        },
      ],
    });
  });

  it("refuses a Warmmiete below the Kaltmiete", () => {
    expect(
      listingFromFacts(facts({ kaltmiete: "1.200", warmmiete: "1.100" }), URL),
    ).toEqual({
      ok: false,
      problems: [
        {
          field: "warmmiete",
          message:
            "The Warmmiete includes the Kaltmiete, so it cannot be lower",
        },
      ],
    });
  });
});
