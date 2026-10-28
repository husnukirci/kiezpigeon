import { describe, expect, it } from "vitest";
import { coupleWithDog, soloStudent } from "../../test-support/sample-profiles";
import {
  defaultProfile,
  exportData,
  importData,
  parseApplication,
  parseProfile,
} from "./profile";
import type { Application } from "./types";

const application: Application = {
  id: "app_k3x9",
  listingUrl: "https://www.immobilienscout24.de/expose/100000001",
  listingTitle: "Helle 2-Zimmer-Altbauwohnung mit Balkon",
  district: "Kreuzberg",
  warmmieteCents: 140000,
  letter: "Sehr geehrte Frau Weber, ...",
  status: "sent",
  sentAt: "2027-02-01T09:30:00.000Z",
  statusChangedAt: "2027-02-01T09:30:00.000Z",
};

function problemsOf(input: unknown): string[] {
  const result = parseProfile(input);
  return result.ok ? [] : result.problems;
}

function withChanges(changes: Record<string, unknown>): unknown {
  return { ...structuredClone(coupleWithDog), ...changes };
}

describe("parseProfile", () => {
  it("accepts the sample profiles unchanged", () => {
    expect(parseProfile(coupleWithDog)).toEqual({
      ok: true,
      value: coupleWithDog,
    });
    expect(parseProfile(soloStudent)).toEqual({
      ok: true,
      value: soloStudent,
    });
  });

  it("drops keys it does not know", () => {
    const result = parseProfile({ ...coupleWithDog, apiKey: "secret" });
    expect(result.ok && "apiKey" in result.value).toBe(false);
  });

  it("rejects something that is not an object", () => {
    expect(problemsOf(null)).toEqual(["profile: must be an object"]);
    expect(problemsOf([])).toEqual(["profile: must be an object"]);
  });

  it("needs one or two applicants", () => {
    expect(problemsOf(withChanges({ applicants: [] }))).toEqual([
      "applicants: must have 1 or 2 entries",
    ]);
    const three = [...coupleWithDog.applicants, coupleWithDog.applicants[0]];
    expect(problemsOf(withChanges({ applicants: three }))).toEqual([
      "applicants: must have 1 or 2 entries",
    ]);
  });

  it("needs non-negative whole cents for income and budget", () => {
    const applicants = structuredClone(coupleWithDog.applicants);
    const second = applicants[1];
    if (second) second.netIncomeCents = -100;
    expect(
      problemsOf(withChanges({ applicants, budgetWarmCents: 1300.5 })),
    ).toEqual([
      "applicants[1].netIncomeCents: must be whole cents, 0 or more",
      "budgetWarmCents: must be whole cents, 0 or more",
    ]);
  });

  it("needs at least one adult and counts of 0 or more", () => {
    const household = {
      adults: 0,
      children: -1,
      pets: [{ kind: "cat", count: -2 }],
      smoker: false,
    };
    expect(problemsOf(withChanges({ household }))).toEqual([
      "household.adults: must be a whole number, 1 or more",
      "household.children: must be a whole number, 0 or more",
      "household.pets[0].count: must be a whole number, 0 or more",
    ]);
  });

  it("needs real calendar dates", () => {
    expect(problemsOf(withChanges({ moveInDate: "2027-02-30" }))).toEqual([
      "moveInDate: must be a date as YYYY-MM-DD",
    ]);
    expect(problemsOf(withChanges({ moveInDate: "01.03.2027" }))).toEqual([
      "moveInDate: must be a date as YYYY-MM-DD",
    ]);
    expect(problemsOf(withChanges({ moveInDate: "2028-02-29" }))).toEqual([]);
  });

  it("names every bad enum and missing field at once", () => {
    const broken = withChanges({
      hasWbs: "no",
      letterDefaults: { tone: "cheeky", language: "fr" },
      documents: { ...coupleWithDog.documents, schufa: "maybe" },
      contact: { ...coupleWithDog.contact, email: undefined },
    });
    expect(problemsOf(broken)).toEqual([
      "contact.email: must be text",
      "hasWbs: must be true or false",
      "letterDefaults.tone: must be one of warm, formal, short",
      "letterDefaults.language: must be one of de, en",
      "documents.schufa: must be one of ready, pending",
    ]);
  });
});

describe("defaultProfile", () => {
  it("writes warm German letters and marks every document pending", () => {
    const profile = defaultProfile();
    expect(profile.letterDefaults).toEqual({ tone: "warm", language: "de" });
    expect(Object.values(profile.documents)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("is itself a valid profile with one adult applicant", () => {
    const profile = defaultProfile();
    expect(parseProfile(profile).ok).toBe(true);
    expect(profile.applicants.map((a) => a.id)).toEqual(["a1"]);
    expect(profile.household.adults).toBe(1);
  });
});

describe("parseApplication", () => {
  it("accepts a saved application", () => {
    expect(parseApplication(application)).toEqual({
      ok: true,
      value: application,
    });
  });

  it("names a bad status and a bad timestamp", () => {
    const result = parseApplication({
      ...application,
      status: "ghosted",
      sentAt: "yesterday",
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        "status: must be one of sent, viewing, closed",
        "sentAt: must be a date and time",
      ],
    });
  });
});

describe("export and import", () => {
  const exportedAt = "2027-02-10T18:00:00.000Z";

  it("exports a versioned file with the profile and applications only", () => {
    const file = exportData(coupleWithDog, [application], exportedAt);
    expect(Object.keys(file)).toEqual([
      "kiezpigeon",
      "exportedAt",
      "profile",
      "applications",
    ]);
    expect(file.kiezpigeon).toBe(1);
    expect(file.exportedAt).toBe(exportedAt);
  });

  it("never carries an API key, even one smuggled into the profile", () => {
    const smuggled = { ...coupleWithDog, apiKey: "sk-ant-not-a-real-key" };
    const json = JSON.stringify(exportData(smuggled, [], exportedAt));
    expect(json).not.toContain("sk-ant");
    expect(json).not.toContain("apiKey");
  });

  it("round-trips through JSON", () => {
    const json = JSON.stringify(
      exportData(coupleWithDog, [application], exportedAt),
    );
    expect(importData(json)).toEqual({
      ok: true,
      value: { profile: coupleWithDog, applications: [application] },
    });
  });

  it("rejects text that is not JSON", () => {
    expect(importData("{not json")).toEqual({
      ok: false,
      problems: ["file: is not valid JSON"],
    });
  });

  it("rejects an unknown schema version before looking further", () => {
    const json = JSON.stringify({
      ...exportData(coupleWithDog, [], exportedAt),
      kiezpigeon: 2,
    });
    expect(importData(json)).toEqual({
      ok: false,
      problems: ["kiezpigeon: unknown file version 2"],
    });
  });

  it("rejects a file that is not a Kiezpigeon export", () => {
    expect(importData(JSON.stringify({ hello: "world" }))).toEqual({
      ok: false,
      problems: ["kiezpigeon: not a Kiezpigeon export"],
    });
  });

  it("names every problem across profile and applications, importing nothing", () => {
    const file = exportData(coupleWithDog, [application], exportedAt);
    const json = JSON.stringify({
      ...file,
      profile: { ...file.profile, hasWbs: "yes" },
      applications: [application, { ...application, status: "lost" }],
    });
    expect(importData(json)).toEqual({
      ok: false,
      problems: [
        "profile.hasWbs: must be true or false",
        "applications[1].status: must be one of sent, viewing, closed",
      ],
    });
  });
});
