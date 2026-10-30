import { describe, expect, it } from "vitest";
import { coupleWithDog, soloStudent } from "../../test-support/sample-profiles";
import {
  defaultProfile,
  exportData,
  importData,
  defaultSettings,
  parseApiKey,
  parseApplication,
  parseProfile,
  parseSettings,
  upgradeProfileV1,
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

  it("accepts an applicant who is looking for work", () => {
    const seeking = withChanges({
      applicants: [
        { ...coupleWithDog.applicants[0], employment: "job_seeking" },
      ],
    });
    expect(parseProfile(seeking)).toMatchObject({ ok: true });
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

  it("keeps how two applicants are related", () => {
    for (const relationship of ["partners", "married", "flatmates", "family"]) {
      const household = { ...coupleWithDog.household, relationship };
      const parsed = parseProfile(withChanges({ household }));
      expect(parsed.ok && parsed.value.household.relationship).toBe(
        relationship,
      );
    }
  });

  it("drops a relationship that a single applicant cannot have", () => {
    const parsed = parseProfile({
      ...coupleWithDog,
      applicants: coupleWithDog.applicants.slice(0, 1),
      household: { ...coupleWithDog.household, relationship: "married" },
    });
    expect(parsed.ok && "relationship" in parsed.value.household).toBe(false);
  });

  it("names an unknown relationship", () => {
    const household = { ...coupleWithDog.household, relationship: "dating" };
    expect(problemsOf(withChanges({ household }))).toEqual([
      "household.relationship: must be one of partners, married, flatmates, family",
    ]);
  });

  it("reads each move-in kind", () => {
    for (const moveIn of [
      { kind: "date", date: "2027-03-01" },
      { kind: "asap" },
      { kind: "flexible" },
    ]) {
      const parsed = parseProfile(withChanges({ moveIn }));
      expect(parsed.ok && parsed.value.moveIn).toEqual(moveIn);
    }
  });

  it("needs real calendar dates and a known move-in kind", () => {
    const on = (date: string) =>
      problemsOf(withChanges({ moveIn: { kind: "date", date } }));
    expect(on("2027-02-30")).toEqual([
      "moveIn.date: must be a date as YYYY-MM-DD",
    ]);
    expect(on("01.03.2027")).toEqual([
      "moveIn.date: must be a date as YYYY-MM-DD",
    ]);
    expect(on("2028-02-29")).toEqual([]);
    expect(problemsOf(withChanges({ moveIn: { kind: "soon" } }))).toEqual([
      "moveIn.kind: must be one of date, asap, flexible",
    ]);
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

  it("accepts only a web address as the listing, since the tracker links it", () => {
    for (const listingUrl of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "www.immobilienscout24.de/expose/1",
      "https://",
    ]) {
      expect(parseApplication({ ...application, listingUrl })).toEqual({
        ok: false,
        problems: ["listingUrl: must be a web address (http or https)"],
      });
    }
    expect(
      parseApplication({ ...application, listingUrl: "http://example.org/1" })
        .ok,
    ).toBe(true);
  });
});

/** A profile as schema 1 stored it: a bare `moveInDate`. */
function v1Profile(moveInDate?: string): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...coupleWithDog };
  delete rest.moveIn;
  return moveInDate === undefined ? rest : { ...rest, moveInDate };
}

describe("upgradeProfileV1", () => {
  it("turns a version 1 move-in date into a date move-in", () => {
    expect(upgradeProfileV1(v1Profile("2027-03-01"))).toEqual({
      ...v1Profile(),
      moveIn: { kind: "date", date: "2027-03-01" },
    });
  });

  it("leaves a profile without a move-in date, or a non-object, as it is", () => {
    expect(upgradeProfileV1(v1Profile())).toEqual(v1Profile());
    expect(upgradeProfileV1("nonsense")).toBe("nonsense");
    expect(upgradeProfileV1(null)).toBe(null);
  });
});

describe("export and import", () => {
  const exportedAt = "2027-02-10T18:00:00.000Z";

  it("imports a version 1 export and carries the move-in over", () => {
    const json = JSON.stringify({
      kiezpigeon: 1,
      exportedAt,
      profile: v1Profile("2027-03-01"),
      applications: [],
    });
    const result = importData(json);
    expect(result.ok && result.value.profile.moveIn).toEqual({
      kind: "date",
      date: "2027-03-01",
    });
  });

  it("exports a versioned file with the profile and applications only", () => {
    const file = exportData(coupleWithDog, [application], exportedAt);
    expect(Object.keys(file)).toEqual([
      "kiezpigeon",
      "exportedAt",
      "profile",
      "applications",
    ]);
    expect(file.kiezpigeon).toBe(2);
    expect(file.exportedAt).toBe(exportedAt);
  });

  it("never carries an API key, even one smuggled into the profile", () => {
    const smuggled = { ...coupleWithDog, apiKey: "FAKE-KEY-FOR-EXPORT-TEST" };
    const json = JSON.stringify(exportData(smuggled, [], exportedAt));
    expect(json).not.toContain("FAKE-KEY");
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
      kiezpigeon: 3,
    });
    expect(importData(json)).toEqual({
      ok: false,
      problems: ["kiezpigeon: unknown file version 3"],
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

describe("parseSettings", () => {
  it("defaults to Sonnet", () => {
    expect(defaultSettings()).toEqual({ model: "claude-sonnet-5-5" });
  });

  it("accepts Haiku as the cheaper model and keeps only known keys", () => {
    expect(parseSettings({ model: "claude-haiku-5-5", theme: "dark" })).toEqual(
      { ok: true, value: { model: "claude-haiku-5-5" } },
    );
  });

  it("accepts Opus and Fable for stronger letters", () => {
    for (const model of ["claude-opus-5-5", "claude-fable-5-1"]) {
      expect(parseSettings({ model })).toEqual({ ok: true, value: { model } });
    }
  });

  it("names an unknown model", () => {
    expect(parseSettings({ model: "gpt" })).toEqual({
      ok: false,
      problems: [
        "model: must be one of claude-sonnet-5-5, claude-opus-5-5, claude-fable-5-1, claude-haiku-5-5",
      ],
    });
  });
});

describe("parseApiKey", () => {
  it("trims the key", () => {
    expect(parseApiKey("  FAKE-KEY-123\n")).toEqual({
      ok: true,
      value: "FAKE-KEY-123",
    });
  });

  it("rejects an empty key or one with spaces inside, without echoing it", () => {
    for (const input of ["", "   ", "FAKE KEY", 42]) {
      const result = parseApiKey(input);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain("FAKE");
    }
  });
});
