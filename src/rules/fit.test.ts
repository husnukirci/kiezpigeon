import { describe, expect, it } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
  soloStudent,
  sparseListing,
} from "../../test-support/sample-profiles";
import { checkFit } from "./fit";
import type { FitLine, FitRule, Listing, Profile } from "./types";

function line(profile: Profile, listing: Listing, rule: FitRule): FitLine {
  const found = checkFit(profile, listing).find((l) => l.rule === rule);
  if (!found) throw new Error(`no ${rule} line`);
  return found;
}

const noPets: Profile = {
  ...coupleWithDog,
  household: { ...coupleWithDog.household, pets: [] },
};

function listingWith(changes: Partial<Listing>): Listing {
  return { ...kreuzbergListing, ...changes };
}

describe("checkFit", () => {
  it("returns budget, income, pets and WBS lines in that order", () => {
    expect(checkFit(coupleWithDog, kreuzbergListing)).toEqual([
      { rule: "budget", status: "warn", reason: "100 € over your budget" },
      { rule: "income", status: "ok", reason: "Income is 3.8 × Kaltmiete" },
      {
        rule: "pets",
        status: "warn",
        reason: "Pets by arrangement. I'll mention them honestly.",
      },
      { rule: "wbs", status: "ok", reason: "No WBS needed" },
    ]);
  });

  it("returns four unknown-ish lines for a listing that shows nothing", () => {
    expect(checkFit(soloStudent, sparseListing)).toEqual([
      {
        rule: "budget",
        status: "unknown",
        reason: "Set a budget in your profile",
      },
      { rule: "income", status: "unknown", reason: "Kaltmiete not shown" },
      { rule: "pets", status: "ok", reason: "No pets" },
      { rule: "wbs", status: "unknown", reason: "Listing doesn't say" },
    ]);
  });
});

describe("budget line", () => {
  const budget = 130000;
  const profile = { ...coupleWithDog, budgetWarmCents: budget };

  it("is unknown without a budget in the profile", () => {
    const withoutBudget = { ...coupleWithDog, budgetWarmCents: undefined };
    expect(line(withoutBudget, kreuzbergListing, "budget")).toEqual({
      rule: "budget",
      status: "unknown",
      reason: "Set a budget in your profile",
    });
  });

  it("uses the Warmmiete when the listing shows it", () => {
    const listing = listingWith({ warmmieteCents: 130000 });
    expect(line(profile, listing, "budget")).toEqual({
      rule: "budget",
      status: "ok",
      reason: "Within your 1.300 € budget",
    });
  });

  it("adds Kaltmiete and Nebenkosten when the Warmmiete is missing", () => {
    const listing = listingWith({
      warmmieteCents: undefined,
      kaltmieteCents: 100000,
      nebenkostenCents: 30000,
    });
    expect(line(profile, listing, "budget").status).toBe("ok");
    const over = listingWith({
      warmmieteCents: undefined,
      kaltmieteCents: 100000,
      nebenkostenCents: 30100,
    });
    expect(line(profile, over, "budget")).toEqual({
      rule: "budget",
      status: "warn",
      reason: "1 € over your budget",
    });
  });

  it("is unknown when the rent cannot be worked out", () => {
    const listing = listingWith({
      warmmieteCents: undefined,
      nebenkostenCents: undefined,
    });
    expect(line(profile, listing, "budget")).toEqual({
      rule: "budget",
      status: "unknown",
      reason: "Rent not shown",
    });
  });

  it("warns up to and including 10% over the budget", () => {
    expect(
      line(profile, listingWith({ warmmieteCents: 143000 }), "budget"),
    ).toEqual({
      rule: "budget",
      status: "warn",
      reason: "130 € over your budget",
    });
  });

  it("says no beyond 10% over the budget", () => {
    expect(
      line(profile, listingWith({ warmmieteCents: 143001 }), "budget"),
    ).toEqual({
      rule: "budget",
      status: "no",
      reason: "130,01 € over your budget",
    });
    expect(
      line(profile, listingWith({ warmmieteCents: 156000 }), "budget"),
    ).toEqual({
      rule: "budget",
      status: "no",
      reason: "260 € over your budget",
    });
  });
});

describe("income line", () => {
  // coupleWithDog earns 4.600 € net together.
  it("sums both applicants and floors the ratio to one decimal", () => {
    expect(
      line(coupleWithDog, listingWith({ kaltmieteCents: 135000 }), "income"),
    ).toEqual({
      rule: "income",
      status: "ok",
      reason: "Income is 3.4 × Kaltmiete",
    });
  });

  it("is ok at exactly 3.0", () => {
    expect(
      line(coupleWithDog, listingWith({ kaltmieteCents: 153333 }), "income"),
    ).toEqual({
      rule: "income",
      status: "ok",
      reason: "Income is 3.0 × Kaltmiete",
    });
  });

  it("warns just under 3.0, and never says no", () => {
    expect(
      line(coupleWithDog, listingWith({ kaltmieteCents: 153334 }), "income"),
    ).toEqual({
      rule: "income",
      status: "warn",
      reason: "Income is 2.9 × Kaltmiete. Many landlords ask for 3 ×.",
    });
    expect(
      line(soloStudent, listingWith({ kaltmieteCents: 118000 }), "income"),
    ).toEqual({
      rule: "income",
      status: "warn",
      reason: "Income is 0.8 × Kaltmiete. Many landlords ask for 3 ×.",
    });
  });

  it("is unknown without a Kaltmiete", () => {
    expect(
      line(coupleWithDog, listingWith({ kaltmieteCents: undefined }), "income"),
    ).toEqual({
      rule: "income",
      status: "unknown",
      reason: "Kaltmiete not shown",
    });
  });
});

describe("pets line", () => {
  it("is ok without pets whatever the listing says", () => {
    expect(
      line(noPets, listingWith({ petPolicy: "not_allowed" }), "pets"),
    ).toEqual({ rule: "pets", status: "ok", reason: "No pets" });
  });

  it("treats a pet with count 0 as no pet", () => {
    const zero = {
      ...coupleWithDog,
      household: {
        ...coupleWithDog.household,
        pets: [{ kind: "cat" as const, count: 0 }],
      },
    };
    expect(line(zero, kreuzbergListing, "pets").reason).toBe("No pets");
  });

  it("is ok when pets are allowed", () => {
    expect(
      line(coupleWithDog, listingWith({ petPolicy: "allowed" }), "pets"),
    ).toEqual({ rule: "pets", status: "ok", reason: "Pets allowed" });
  });

  it("warns when pets are by arrangement or the listing is silent", () => {
    const expected = {
      rule: "pets",
      status: "warn",
      reason: "Pets by arrangement. I'll mention them honestly.",
    };
    expect(
      line(coupleWithDog, listingWith({ petPolicy: "by_arrangement" }), "pets"),
    ).toEqual(expected);
    expect(
      line(coupleWithDog, listingWith({ petPolicy: undefined }), "pets"),
    ).toEqual(expected);
  });

  it("says no when pets are not allowed", () => {
    expect(
      line(coupleWithDog, listingWith({ petPolicy: "not_allowed" }), "pets"),
    ).toEqual({ rule: "pets", status: "no", reason: "No pets allowed here" });
  });
});

describe("WBS line", () => {
  it("is ok when a WBS is required and you have one", () => {
    expect(
      line(soloStudent, listingWith({ wbsRequired: true }), "wbs"),
    ).toEqual({ rule: "wbs", status: "ok", reason: "You have a WBS" });
  });

  it("says no when a WBS is required and you have none", () => {
    expect(
      line(coupleWithDog, listingWith({ wbsRequired: true }), "wbs"),
    ).toEqual({ rule: "wbs", status: "no", reason: "This flat needs a WBS" });
  });

  it("is ok when the listing says no WBS is needed", () => {
    expect(
      line(soloStudent, listingWith({ wbsRequired: false }), "wbs"),
    ).toEqual({ rule: "wbs", status: "ok", reason: "No WBS needed" });
  });

  it("is unknown when the listing is silent", () => {
    expect(
      line(coupleWithDog, listingWith({ wbsRequired: undefined }), "wbs"),
    ).toEqual({
      rule: "wbs",
      status: "unknown",
      reason: "Listing doesn't say",
    });
  });
});
