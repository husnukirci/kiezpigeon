// The request for "Analyse this listing": the listing, its page text and the
// few profile facts that bear on fit. Names, contact details, jobs and raw
// income never leave the profile; the user's own values are also scrubbed
// from the page text, which may show them when they are signed in.
import { ratioTenths } from "./letterPrompt";
import type { AnalysisRequest, Listing, Profile } from "./types";

export const PAGE_TEXT_MAX = 20_000;

const MARK = "…";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The values to remove: each name, the email, the phone and the street. */
function ownValues(profile: Profile): string[] {
  const { contact } = profile;
  return [
    ...profile.applicants.flatMap((a) => [a.firstName, a.lastName]),
    contact.email,
    contact.phone,
    contact.street,
  ]
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function removeValue(text: string, value: string): string {
  const parts = value.split(/\s+/).map(escapeRegExp);
  return text.replace(new RegExp(parts.join("\\s+"), "gi"), MARK);
}

export function createAnalysisRequest(
  profile: Profile,
  listing: Listing,
  pageText: string,
): AnalysisRequest {
  // Longest first, so a full name goes before its parts.
  const values = ownValues(profile).sort((a, b) => b.length - a.length);
  const cleaned = values
    .reduce(removeValue, pageText)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PAGE_TEXT_MAX);
  return {
    listing,
    pageText: cleaned,
    budgetWarmCents: profile.budgetWarmCents,
    household: { ...profile.household },
    hasWbs: profile.hasWbs,
    moveIn: profile.moveIn,
    employment: profile.applicants.map((a) => a.employment),
    incomeRatioTenths: ratioTenths(profile.applicants, listing),
  };
}
