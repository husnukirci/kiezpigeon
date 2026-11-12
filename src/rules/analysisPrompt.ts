// The prompt for "Analyse this listing": the page text and the few profile
// facts that bear on fit. Pure; the call itself lives in src/claude/.
import { formatDate, formatEuro } from "./format";
import { hasPets, listingLines, petsPhrase } from "./letterPrompt";
import type { AnalysisRequest, MoveIn, Prompt } from "./types";

export const ANALYSIS_HEADINGS = [
  "What this is",
  "The area",
  "Price",
  "Heating and energy",
  "For you",
  "What to watch for",
] as const;

export type AnalysisHeading = (typeof ANALYSIS_HEADINGS)[number];

const NOT_GIVEN = "not given";

function system(): string {
  return [
    "You help someone who is looking for a flat in Berlin to understand one rental listing before they apply.",
    "You read only the listing page text and the facts you are given, plus your general knowledge of Berlin and its rental market. You never claim to have looked anything up, checked a register, a map or another website, or contacted anyone. If you rely on general knowledge, say so.",
    "",
    "Write the answer in exactly these sections, in this order, each starting with its heading on its own line:",
    ...ANALYSIS_HEADINGS.map((heading) => `## ${heading}`),
    "",
    "Section notes:",
    "- What this is: the kind of flat and the kind of landlord or offer, as far as the page shows.",
    "- The area: the district and what is generally known about it.",
    "- Price: how the Kaltmiete and the extra costs read against the page and the usual range; never a figure the page does not support.",
    "- Heating and energy: what the page says about heating, energy source and energy certificate, and what that usually means for the running costs.",
    "- For you: how the listing fits the profile facts below. Name what the profile does not say instead of guessing it.",
    "- What to watch for: points to ask about or check, such as the lease type, the Kaution, fees, unclear wording.",
    "",
    "Rules:",
    "- Write in English, in sentence case, in short plain sentences, addressing the reader as you. German market terms stay German (Kaltmiete, Warmmiete, Nebenkosten, Kaution, WBS, Besichtigung, Staffelmiete).",
    "- Word estimates as estimates (usually, roughly, often). Say so when something is unknown. Never invent a fact that is neither on the page nor general knowledge.",
    "- No score, no traffic light, no rating and no verdict. Never use words such as scam or fraud, and never say a listing is good or bad overall. Describe, then let the reader decide.",
    "- No em dashes. No emojis. No markdown other than the `## ` section headings and `- ` bullet lines: no bold, no italics, no tables.",
    "- Keep it short: a few sentences or bullets per section.",
  ].join("\n");
}

function moveInLine(moveIn: MoveIn | undefined): string {
  switch (moveIn?.kind) {
    case undefined:
      return NOT_GIVEN;
    case "date":
      return formatDate(moveIn.date);
    case "asap":
      return "as soon as possible";
    case "flexible":
      return "flexible";
  }
}

function factsBlock(request: AnalysisRequest): string {
  const { household } = request;
  const ratio =
    request.incomeRatioTenths === undefined
      ? NOT_GIVEN
      : (request.incomeRatioTenths / 10).toFixed(1);
  return [
    "Profile facts:",
    `- budget: ${request.budgetWarmCents === undefined ? NOT_GIVEN : `${formatEuro(request.budgetWarmCents)} Warmmiete`}`,
    `- adults: ${household.adults}`,
    `- children: ${household.children}`,
    `- pets: ${hasPets(household) ? petsPhrase(household) : "none"}`,
    `- smoker: ${household.smoker ? "yes" : "no"}`,
    `- WBS: ${request.hasWbs ? "yes" : "no"}`,
    `- move-in: ${moveInLine(request.moveIn)}`,
    `- employment: ${request.employment.length === 0 ? NOT_GIVEN : request.employment.join(", ")}`,
    `- income to Kaltmiete: ${ratio}`,
  ].join("\n");
}

function listingBlock(request: AnalysisRequest): string {
  const { listing } = request;
  const contact = listing.contactPerson;
  const contactName = [contact?.salutation, contact?.lastName]
    .filter(Boolean)
    .join(" ");
  const extra = [
    ...(listing.address === undefined ? [] : [`- Adresse: ${listing.address}`]),
    ...(contactName === "" ? [] : [`- Kontakt: ${contactName}`]),
  ];
  const lines = listingLines(listing);
  if (lines.length === 0 && extra.length > 0)
    return ["Wohnung:", ...extra].join("\n");
  return [...lines, ...extra].join("\n");
}

export function buildAnalysisPrompt(request: AnalysisRequest): Prompt {
  return {
    system: system(),
    user: [
      factsBlock(request),
      "",
      listingBlock(request),
      "",
      "Listing page text:",
      request.pageText,
    ].join("\n"),
  };
}
