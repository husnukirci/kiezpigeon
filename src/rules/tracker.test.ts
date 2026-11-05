import { describe, expect, it } from "vitest";
import {
  kreuzbergListing,
  sparseListing,
} from "../../test-support/sample-profiles";
import {
  filterApplications,
  newApplication,
  refill,
  setStatus,
  trackerStats,
} from "./tracker";
import type { Application, ApplicationStatus } from "./types";

function app(
  id: string,
  status: ApplicationStatus,
  sentAt: string,
): Application {
  return {
    id,
    listingUrl: `https://www.immobilienscout24.de/expose/${id}`,
    letter: "Sehr geehrte Damen und Herren, ...",
    status,
    sentAt,
    statusChangedAt: sentAt,
  };
}

const now = "2027-02-10T12:00:00.000Z";

const apps = [
  app("app_a", "sent", "2027-02-09T08:00:00.000Z"),
  app("app_b", "viewing", "2027-02-03T12:00:00.001Z"),
  app("app_c", "closed", "2027-01-15T10:00:00.000Z"),
  app("app_d", "sent", "2027-02-03T12:00:00.000Z"),
  app("app_e", "sent", "2027-02-10T11:59:59.000Z"),
];

/** A letter that went into a form; nobody said it was sent. */
function filled(id: string, statusChangedAt: string): Application {
  return {
    id,
    listingUrl: `https://www.immobilienscout24.de/expose/${id}`,
    letter: "Sehr geehrte Damen und Herren, ...",
    status: "filled",
    statusChangedAt,
  };
}

const withFilled = [...apps, filled("app_f", "2027-02-09T20:00:00.000Z")];

describe("newApplication", () => {
  it("saves the listing summary and the letter as sent, now", () => {
    expect(
      newApplication(kreuzbergListing, "Sehr geehrte Frau Weber, ...", {
        now,
        random: "k3x9",
      }),
    ).toEqual({
      id: "app_k3x9",
      listingUrl: "https://www.immobilienscout24.de/expose/100000001",
      listingTitle: "Helle 2-Zimmer-Altbauwohnung mit Balkon",
      district: "Kreuzberg",
      warmmieteCents: 140000,
      letter: "Sehr geehrte Frau Weber, ...",
      status: "sent",
      sentAt: now,
      statusChangedAt: now,
    });
  });

  it("saves a filled letter without a send date", () => {
    expect(
      newApplication(kreuzbergListing, "Hallo", {
        now,
        random: "k3x9",
        status: "filled",
      }),
    ).toMatchObject({ id: "app_k3x9", status: "filled", statusChangedAt: now });
    expect(
      "sentAt" in
        newApplication(kreuzbergListing, "Hallo", {
          now,
          random: "k3x9",
          status: "filled",
        }),
    ).toBe(false);
  });

  it("leaves out what the listing did not show", () => {
    const saved = newApplication(sparseListing, "Hallo", { now, random: "a" });
    expect(Object.keys(saved).sort()).toEqual([
      "id",
      "letter",
      "listingUrl",
      "sentAt",
      "status",
      "statusChangedAt",
    ]);
  });
});

describe("setStatus", () => {
  it("records when the status changed", () => {
    const changed = setStatus(apps[0] as Application, "viewing", now);
    expect(changed.status).toBe("viewing");
    expect(changed.statusChangedAt).toBe(now);
    expect(changed.sentAt).toBe("2027-02-09T08:00:00.000Z");
  });

  it("sets the send date when a filled letter is first marked sent", () => {
    const sent = setStatus(
      filled("x", "2027-02-01T00:00:00.000Z"),
      "sent",
      now,
    );
    expect(sent).toEqual({
      ...filled("x", "2027-02-01T00:00:00.000Z"),
      status: "sent",
      sentAt: now,
      statusChangedAt: now,
    });
    // Straight to a viewing is still a send the user is telling us about.
    expect(
      setStatus(filled("x", "2027-02-01T00:00:00.000Z"), "viewing", now).sentAt,
    ).toBe(now);
  });

  it("drops the send date when a letter goes back to filled", () => {
    const back = setStatus(
      app("x", "sent", "2027-02-01T00:00:00.000Z"),
      "filled",
      now,
    );
    expect(back.status).toBe("filled");
    expect("sentAt" in back).toBe(false);
    expect(back.statusChangedAt).toBe(now);
  });

  it("allows any status from any other, so mistakes can be corrected", () => {
    const statuses: ApplicationStatus[] = [
      "filled",
      "sent",
      "viewing",
      "closed",
    ];
    for (const from of statuses) {
      for (const to of statuses) {
        expect(setStatus(app("x", from, now), to, now).status).toBe(to);
      }
    }
  });

  it("leaves the record alone when the status does not change", () => {
    const original = apps[1] as Application;
    expect(setStatus(original, "viewing", now)).toBe(original);
  });

  it("does not change the record passed in", () => {
    const original = app("x", "sent", "2027-02-01T00:00:00.000Z");
    setStatus(original, "closed", now);
    expect(original.status).toBe("sent");
  });
});

describe("refill", () => {
  it("replaces the letter of a filled record", () => {
    const again = refill(filled("x", now), "Sehr geehrte Frau Weber, neu.");
    expect(again.letter).toBe("Sehr geehrte Frau Weber, neu.");
    expect(again.status).toBe("filled");
  });

  it("keeps the letter that was sent", () => {
    const sent = app("x", "sent", now);
    expect(refill(sent, "Anders")).toBe(sent);
  });

  it("leaves the record alone when the letter is the same", () => {
    const same = filled("x", now);
    expect(refill(same, same.letter)).toBe(same);
  });
});

describe("trackerStats", () => {
  it("counts per status and the applications sent in the last 7 days", () => {
    expect(trackerStats(withFilled, now)).toEqual({
      total: 6,
      filled: 1,
      sentTotal: 5,
      sent: 3,
      viewing: 1,
      closed: 1,
      sentLast7Days: 3,
    });
  });

  it("counts by send date, whatever the status is now", () => {
    // app_b is at "viewing" and was sent 6 days 23:59:59.999 ago.
    expect(trackerStats([apps[1] as Application], now).sentLast7Days).toBe(1);
  });

  it("stops counting at exactly 7 days", () => {
    // app_d was sent exactly 7 days ago.
    expect(trackerStats([apps[3] as Application], now).sentLast7Days).toBe(0);
  });

  it("ignores a send date in the future", () => {
    const future = app("app_f", "sent", "2027-02-11T00:00:00.000Z");
    expect(trackerStats([future], now).sentLast7Days).toBe(0);
  });

  it("is all zeros for no applications", () => {
    expect(trackerStats([], now)).toEqual({
      total: 0,
      filled: 0,
      sentTotal: 0,
      sent: 0,
      viewing: 0,
      closed: 0,
      sentLast7Days: 0,
    });
  });
});

describe("filterApplications", () => {
  it("lists all, newest first", () => {
    expect(filterApplications(apps, "all").map((a) => a.id)).toEqual([
      "app_e",
      "app_a",
      "app_b",
      "app_d",
      "app_c",
    ]);
  });

  it("keeps one status, newest first", () => {
    expect(filterApplications(apps, "sent").map((a) => a.id)).toEqual([
      "app_e",
      "app_a",
      "app_d",
    ]);
    expect(filterApplications(apps, "viewing").map((a) => a.id)).toEqual([
      "app_b",
    ]);
    expect(filterApplications(apps, "closed").map((a) => a.id)).toEqual([
      "app_c",
    ]);
  });

  it("places a filled letter by the day it was filled, and filters it", () => {
    // app_f was filled on the 9th at 20:00, after app_a was sent that morning.
    expect(filterApplications(withFilled, "all").map((a) => a.id)).toEqual([
      "app_e",
      "app_f",
      "app_a",
      "app_b",
      "app_d",
      "app_c",
    ]);
    expect(filterApplications(withFilled, "filled").map((a) => a.id)).toEqual([
      "app_f",
    ]);
  });

  it("does not reorder the list passed in", () => {
    const ids = apps.map((a) => a.id);
    filterApplications(apps, "all");
    expect(apps.map((a) => a.id)).toEqual(ids);
  });
});
