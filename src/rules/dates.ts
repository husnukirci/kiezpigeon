// Date arithmetic on ISO dates, shared by the fit check and the letter so
// both judge a move-in the same way. No clock: dates are passed in.
import type { IsoDate } from "./types";

/** A move-in this many days after the free-from date still counts as close. */
export const CLOSE_DAYS = 31;

/** Whole days from `from` to `to`, both ISO dates. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const utc = (iso: IsoDate): number => {
    const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** True when the move-in is on the free-from date or up to CLOSE_DAYS after. */
export function isCloseMoveIn(freeFrom: IsoDate, moveIn: IsoDate): boolean {
  const days = daysBetween(freeFrom, moveIn);
  return days >= 0 && days <= CLOSE_DAYS;
}
