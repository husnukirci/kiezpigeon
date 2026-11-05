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
  /** Letters that went into a form and were never marked sent. */
  filled: number;
  /** Every record the user marked sent, whatever its status is now. */
  sentTotal: number;
  sent: number;
  viewing: number;
  closed: number;
  sentLast7Days: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The record saved when a fill wrote the letter into a form (`filled`) or
 * when the user says they sent it (`sent`). The extension never sends, so a
 * send date comes only from the user's word.
 */
export function newApplication(
  listing: Listing,
  letter: string,
  {
    now,
    random,
    status = "sent",
  }: { now: IsoDateTime; random: string; status?: "filled" | "sent" },
): Application {
  const { url, title, district, warmmieteCents } = listing;
  return {
    id: `app_${random}`,
    listingUrl: url,
    ...(title !== undefined && { listingTitle: title }),
    ...(district !== undefined && { district }),
    ...(warmmieteCents !== undefined && { warmmieteCents }),
    letter,
    status,
    ...(status === "sent" && { sentAt: now }),
    statusChangedAt: now,
  };
}

/**
 * Any status may follow any other; the user corrects mistakes. Leaving
 * `filled` is the user saying the letter was sent, so that sets the send
 * date; going back to `filled` takes it away again.
 */
export function setStatus(
  application: Application,
  status: ApplicationStatus,
  now: IsoDateTime,
): Application {
  if (application.status === status) return application;
  const { sentAt, ...rest } = application;
  if (status === "filled") return { ...rest, status, statusChangedAt: now };
  return { ...rest, status, sentAt: sentAt ?? now, statusChangedAt: now };
}

/** A later fill that wrote: a filled record takes the new letter, a sent
 *  one keeps the letter that was sent. */
export function refill(application: Application, letter: string): Application {
  if (application.status !== "filled" || application.letter === letter) {
    return application;
  }
  return { ...application, letter };
}

export function trackerStats(
  applications: readonly Application[],
  now: IsoDateTime,
): TrackerStats {
  const nowMs = Date.parse(now);
  const count = (status: ApplicationStatus) =>
    applications.filter((a) => a.status === status).length;
  const filled = count("filled");
  return {
    total: applications.length,
    filled,
    sentTotal: applications.length - filled,
    sent: count("sent"),
    viewing: count("viewing"),
    closed: count("closed"),
    sentLast7Days: applications.filter((a) => {
      if (a.sentAt === undefined) return false;
      const age = nowMs - Date.parse(a.sentAt);
      return age >= 0 && age < WEEK_MS;
    }).length,
  };
}

/** The day a record is listed under: when it was sent, else when it was
 *  filled, which is its only status change until then. */
function listedAt(application: Application): number {
  return Date.parse(application.sentAt ?? application.statusChangedAt);
}

/** Newest first by send date, a filled letter by the day it was filled. */
export function filterApplications(
  applications: readonly Application[],
  filter: TrackerFilter,
): Application[] {
  return applications
    .filter((a) => filter === "all" || a.status === filter)
    .sort((a, b) => listedAt(b) - listedAt(a));
}
