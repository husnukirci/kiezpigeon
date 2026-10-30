// The tracker: status changes, stats and filters over saved applications.
// The current time is passed in; nothing here reads the clock.
import type {
  Application,
  ApplicationStatus,
  IsoDateTime,
  Listing,
} from "./types";

export type TrackerFilter = "all" | ApplicationStatus;

export interface TrackerStats {
  total: number;
  sent: number;
  viewing: number;
  closed: number;
  sentLast7Days: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The record saved when the user says they sent the letter. The extension
 * never sends, so it never decides this itself.
 */
export function newApplication(
  listing: Listing,
  letter: string,
  { now, random }: { now: IsoDateTime; random: string },
): Application {
  const { url, title, district, warmmieteCents } = listing;
  return {
    id: `app_${random}`,
    listingUrl: url,
    ...(title !== undefined && { listingTitle: title }),
    ...(district !== undefined && { district }),
    ...(warmmieteCents !== undefined && { warmmieteCents }),
    letter,
    status: "sent",
    sentAt: now,
    statusChangedAt: now,
  };
}

/** Any status may follow any other; the user corrects mistakes. */
export function setStatus(
  application: Application,
  status: ApplicationStatus,
  now: IsoDateTime,
): Application {
  if (application.status === status) return application;
  return { ...application, status, statusChangedAt: now };
}

export function trackerStats(
  applications: readonly Application[],
  now: IsoDateTime,
): TrackerStats {
  const nowMs = Date.parse(now);
  const count = (status: ApplicationStatus) =>
    applications.filter((a) => a.status === status).length;
  return {
    total: applications.length,
    sent: count("sent"),
    viewing: count("viewing"),
    closed: count("closed"),
    sentLast7Days: applications.filter((a) => {
      const age = nowMs - Date.parse(a.sentAt);
      return age >= 0 && age < WEEK_MS;
    }).length,
  };
}

/** Newest first by send date. */
export function filterApplications(
  applications: readonly Application[],
  filter: TrackerFilter,
): Application[] {
  return applications
    .filter((a) => filter === "all" || a.status === filter)
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
}
