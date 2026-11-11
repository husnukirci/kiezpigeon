import { describe, expect, it } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
  soloStudent,
} from "../../test-support/sample-profiles";
import { PAGE_TEXT_MAX, createAnalysisRequest } from "./analysisRequest";
import { createLetterRequest, incomeRatioTenths } from "./letterPrompt";
import type { Listing } from "./types";

const request = createAnalysisRequest(
  coupleWithDog,
  kreuzbergListing,
  "Schöne Wohnung",
);

describe("createAnalysisRequest", () => {
  it("keeps only the fit facts from the profile", () => {
    expect(Object.keys(request).sort()).toEqual([
      "budgetWarmCents",
      "employment",
      "hasWbs",
      "household",
      "incomeRatioTenths",
      "listing",
      "moveIn",
      "pageText",
    ]);
    expect(request.employment).toEqual(["permanent", "civil_servant"]);
    const json = JSON.stringify(request);
    const { applicants, contact } = coupleWithDog;
    const secrets = [
      ...applicants.flatMap((a) => [a.firstName, a.lastName, a.job]),
      contact.email,
      contact.phone,
      contact.street,
      ...applicants.map((a) => String(a.netIncomeCents)),
    ];
    for (const secret of secrets) expect(json).not.toContain(secret);
  });

  describe("removes the user's own values from the page text", () => {
    const { applicants, contact } = coupleWithDog;
    const values = [
      ["first name", applicants[0]?.firstName ?? ""],
      ["last name", applicants[0]?.lastName ?? ""],
      ["second first name", applicants[1]?.firstName ?? ""],
      ["second last name", applicants[1]?.lastName ?? ""],
      ["email", contact.email],
      ["phone", contact.phone],
      ["street", contact.street],
    ] as const;
    for (const [label, value] of values) {
      it(`removes the ${label}`, () => {
        const result = createAnalysisRequest(
          coupleWithDog,
          kreuzbergListing,
          `Angemeldet als ${value} | Schöne Wohnung`,
        );
        expect(value).not.toBe("");
        expect(result.pageText).not.toContain(value);
        expect(result.pageText).toContain("Schöne Wohnung");
      });
    }
  });

  it("removes them in any case and spacing", () => {
    const result = createAnalysisRequest(
      coupleWithDog,
      kreuzbergListing,
      "MARA  TESTMANN | Mara.Testmann@Example.org | MARA.TESTMANN@EXAMPLE.ORG | 030   5550123 | Schöne Wohnung",
    );
    expect(result.pageText).not.toMatch(/mara/i);
    expect(result.pageText).not.toMatch(/testmann/i);
    expect(result.pageText).not.toMatch(/example\.org/i);
    expect(result.pageText).not.toContain("5550123");
    expect(result.pageText).toContain("Schöne Wohnung");
  });

  it("sends the household without the relationship", () => {
    expect(coupleWithDog.household.relationship).toBe("partners");
    expect(request.household).toEqual({
      adults: 2,
      children: 0,
      pets: [{ kind: "dog", count: 1 }],
      smoker: false,
    });
    expect("relationship" in request.household).toBe(false);
    expect(JSON.stringify(request)).not.toContain("partners");
  });

  it("removes an upper-cased email with a plus tag", () => {
    const tagged = {
      ...coupleWithDog,
      contact: { ...coupleWithDog.contact, email: "mara+wohnung@example.org" },
    };
    const result = createAnalysisRequest(
      tagged,
      kreuzbergListing,
      "MARA+WOHNUNG@EXAMPLE.ORG | Schöne Wohnung",
    );
    expect(result.pageText).not.toMatch(/wohnung@/i);
    expect(result.pageText).toContain("Schöne Wohnung");
  });

  it("keeps the listing's own contact and address", () => {
    const listing: Listing = {
      ...kreuzbergListing,
      address: "Ahornweg 3, 10999 Berlin",
    };
    const result = createAnalysisRequest(
      coupleWithDog,
      listing,
      "Ansprechpartnerin Frau Weber, Ahornweg 3, 10999 Berlin",
    );
    expect(result.pageText).toContain("Weber");
    expect(result.pageText).toContain("Ahornweg 3");
    expect(result.listing.address).toBe("Ahornweg 3, 10999 Berlin");
  });

  it("cuts a long page at the cap", () => {
    const result = createAnalysisRequest(
      coupleWithDog,
      kreuzbergListing,
      "a ".repeat(15_000),
    );
    expect(result.pageText.length).toBeLessThanOrEqual(PAGE_TEXT_MAX);
    expect(result.pageText.length).toBeGreaterThan(0);
  });

  it("has the income ratio as the letter has it", () => {
    const letter = createLetterRequest(coupleWithDog, kreuzbergListing, {
      tone: "warm",
      features: [],
    });
    expect(request.incomeRatioTenths).toBe(incomeRatioTenths(letter));
    expect(request.incomeRatioTenths).toBe(38);
  });

  it("has no income ratio without a Kaltmiete", () => {
    const noRent: Listing = { ...kreuzbergListing, kaltmieteCents: undefined };
    const result = createAnalysisRequest(soloStudent, noRent, "text");
    expect(result.incomeRatioTenths).toBeUndefined();
  });
});
