// The fit check: one line per rule, in a fixed order. It informs; it never
// blocks writing a letter. Reasons are UI copy (PHASES.md, Phase 1).
import { CLOSE_DAYS, daysBetween } from "./dates";
import { formatAvailability, formatDate, formatEuro } from "./format";
import { sumCents } from "./money";
import type { Cents, FitLine, Listing, Profile } from "./types";

function rentOf(listing: Listing): Cents | undefined {
  if (listing.warmmieteCents !== undefined) return listing.warmmieteCents;
  if (
    listing.kaltmieteCents !== undefined &&
    listing.nebenkostenCents !== undefined
  ) {
    return listing.kaltmieteCents + listing.nebenkostenCents;
  }
  return undefined;
}

function budgetLine(profile: Profile, listing: Listing): FitLine {
  const budget = profile.budgetWarmCents;
  if (budget === undefined) {
    return {
      rule: "budget",
      status: "unknown",
      reason: "Set a budget in your profile",
    };
  }
  const rent = rentOf(listing);
  if (rent === undefined) {
    return { rule: "budget", status: "unknown", reason: "Rent not shown" };
  }
  if (rent <= budget) {
    return {
      rule: "budget",
      status: "ok",
      reason: `Within your ${formatEuro(budget)} budget`,
    };
  }
  const reason = `${formatEuro(rent - budget)} over your budget`;
  // rent ≤ budget × 1.10, kept in whole cents.
  const withinTenPercent = rent * 100 <= budget * 110;
  return { rule: "budget", status: withinTenPercent ? "warn" : "no", reason };
}

function incomeLine(profile: Profile, listing: Listing): FitLine {
  const kaltmiete = listing.kaltmieteCents;
  if (kaltmiete === undefined || kaltmiete <= 0) {
    return { rule: "income", status: "unknown", reason: "Kaltmiete not shown" };
  }
  const income = sumCents(profile.applicants.map((a) => a.netIncomeCents));
  // The ratio in tenths, floored: 3.47 → 34.
  const tenths = Math.floor((income * 10) / kaltmiete);
  const ratio = `${Math.floor(tenths / 10)}.${tenths % 10}`;
  return tenths >= 30
    ? { rule: "income", status: "ok", reason: `Income is ${ratio} × Kaltmiete` }
    : {
        rule: "income",
        status: "warn",
        reason: `Income is ${ratio} × Kaltmiete. Many landlords ask for 3 ×.`,
      };
}

function petsLine(profile: Profile, listing: Listing): FitLine {
  if (!profile.household.pets.some((pet) => pet.count > 0)) {
    return { rule: "pets", status: "ok", reason: "No pets" };
  }
  switch (listing.petPolicy) {
    case "allowed":
      return { rule: "pets", status: "ok", reason: "Pets allowed" };
    case "not_allowed":
      return { rule: "pets", status: "no", reason: "No pets allowed here" };
    case "by_arrangement":
    case undefined:
      return {
        rule: "pets",
        status: "warn",
        reason: "Pets by arrangement. I'll mention them honestly.",
      };
  }
}

function wbsLine(profile: Profile, listing: Listing): FitLine {
  if (listing.wbsRequired === undefined) {
    return { rule: "wbs", status: "unknown", reason: "Listing doesn't say" };
  }
  if (!listing.wbsRequired) {
    return { rule: "wbs", status: "ok", reason: "No WBS needed" };
  }
  return profile.hasWbs
    ? { rule: "wbs", status: "ok", reason: "You have a WBS" }
    : { rule: "wbs", status: "no", reason: "This flat needs a WBS" };
}

function moveInLine(profile: Profile, listing: Listing): FitLine {
  const { availability } = listing;
  const { moveIn } = profile;
  const line = (status: FitLine["status"], reason: string): FitLine => ({
    rule: "moveIn",
    status,
    reason,
  });
  if (!availability) {
    return line("unknown", "The listing does not say when the flat is free");
  }
  const free = formatAvailability(availability);
  if (!moveIn) {
    return line("unknown", `${free}. Add when you can move in to compare.`);
  }
  if (availability.kind === "by_arrangement") {
    return line("ok", `${free}, so the date can be agreed`);
  }
  if (availability.kind === "immediately") {
    return moveIn.kind === "date"
      ? line(
          "warn",
          `${free}. You want to move in on ${formatDate(moveIn.date)}; check the landlord can wait.`,
        )
      : line("ok", `${free}. You can move in right away.`);
  }
  if (moveIn.kind === "asap") {
    return line("ok", `${free}. You can move in as soon as it is free.`);
  }
  if (moveIn.kind === "flexible") {
    return line("ok", `${free}. Your move-in date is flexible.`);
  }
  const yours = formatDate(moveIn.date);
  const days = daysBetween(availability.date, moveIn.date);
  if (days === 0) return line("ok", `${free}, your move-in date`);
  if (days < 0)
    return line("warn", `${free}, after your move-in date ${yours}`);
  return days <= CLOSE_DAYS
    ? line("ok", `${free}, close to your move-in date ${yours}`)
    : line(
        "warn",
        `${free}, more than a month before your move-in date ${yours}`,
      );
}

export function checkFit(profile: Profile, listing: Listing): FitLine[] {
  return [
    budgetLine(profile, listing),
    incomeLine(profile, listing),
    petsLine(profile, listing),
    wbsLine(profile, listing),
    moveInLine(profile, listing),
  ];
}
