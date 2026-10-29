import { describe, expect, it } from "vitest";
import { coupleWithDog, soloStudent } from "../../test-support/sample-profiles";
import {
  centsToEuroInput,
  parseEuroInput,
  profileProblems,
} from "./profileForm";
import type { Profile } from "./types";

describe("parseEuroInput", () => {
  it.each([
    ["2600", 260000],
    ["2.600", 260000],
    ["2600,5", 260050],
    ["2.600,50", 260050],
    [" 1.180 € ", 118000],
    ["€1180", 118000],
    ["0", 0],
    ["12.345.678", 1234567800],
  ])("reads %j as %i cents", (text, cents) => {
    expect(parseEuroInput(text)).toEqual({ ok: true, value: cents });
  });

  it("reads an empty or blank field as no amount", () => {
    expect(parseEuroInput("")).toEqual({ ok: true, value: undefined });
    expect(parseEuroInput("   ")).toEqual({ ok: true, value: undefined });
  });

  it.each(["abc", "-50", "2.60", "2600,505", "2,600.50", "26.00,5", "1 180"])(
    "rejects %j with a hint on the format",
    (text) => {
      expect(parseEuroInput(text)).toEqual({
        ok: false,
        problems: ["Write the amount like 2.600 or 2.600,50"],
      });
    },
  );
});

describe("centsToEuroInput", () => {
  it.each([
    [260000, "2.600"],
    [260050, "2.600,50"],
    [5, "0,05"],
    [0, "0"],
  ])("writes %i cents as %j", (cents, text) => {
    expect(centsToEuroInput(cents)).toBe(text);
  });

  it("round-trips through parseEuroInput", () => {
    for (const cents of [1, 99, 100, 118000, 345050, 1234567800]) {
      expect(parseEuroInput(centsToEuroInput(cents))).toEqual({
        ok: true,
        value: cents,
      });
    }
  });
});

describe("profileProblems", () => {
  it("finds nothing in complete profiles", () => {
    expect(profileProblems(coupleWithDog)).toEqual([]);
    expect(profileProblems(soloStudent)).toEqual([]);
  });

  it("asks for each applicant's names and income, by field", () => {
    const profile: Profile = {
      ...coupleWithDog,
      applicants: coupleWithDog.applicants.map((applicant, i) =>
        i === 0
          ? { ...applicant, firstName: " ", netIncomeCents: 0 }
          : { ...applicant, lastName: "" },
      ),
    };
    expect(profileProblems(profile)).toEqual([
      { field: "applicants.0.firstName", message: "Add a first name" },
      {
        field: "applicants.0.netIncomeCents",
        message: "Landlords filter on income. Add it for a stronger letter.",
      },
      { field: "applicants.1.lastName", message: "Add a last name" },
    ]);
  });

  it("counts every applicant as an adult", () => {
    const profile: Profile = {
      ...coupleWithDog,
      household: { ...coupleWithDog.household, adults: 1 },
    };
    expect(profileProblems(profile)).toEqual([
      {
        field: "household.adults",
        message: "Count every applicant as an adult",
      },
    ]);
  });

  it("needs an email landlords can reply to", () => {
    const blank = { ...soloStudent.contact, email: "  " };
    expect(profileProblems({ ...soloStudent, contact: blank })).toEqual([
      {
        field: "contact.email",
        message: "Add an email so landlords can reply",
      },
    ]);
    for (const email of [
      "pia@",
      "pia@example",
      "pia example@x.org",
      "@x.org",
    ]) {
      const contact = { ...soloStudent.contact, email };
      expect(profileProblems({ ...soloStudent, contact })).toEqual([
        { field: "contact.email", message: "That email looks incomplete" },
      ]);
    }
  });
});
