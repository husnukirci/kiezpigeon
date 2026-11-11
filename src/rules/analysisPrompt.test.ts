import { describe, expect, it } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { ANALYSIS_HEADINGS, buildAnalysisPrompt } from "./analysisPrompt";
import { createAnalysisRequest } from "./analysisRequest";

const request = createAnalysisRequest(
  coupleWithDog,
  kreuzbergListing,
  "Schöne Altbauwohnung, Gasetagenheizung, Energieausweis liegt vor.",
);

describe("buildAnalysisPrompt", () => {
  it("asks for the six headings in order", () => {
    const { system } = buildAnalysisPrompt(request);
    const positions = ANALYSIS_HEADINGS.map((h) => system.indexOf(`## ${h}`));
    for (const position of positions)
      expect(position).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("puts the page text and the facts in the user part", () => {
    const { user } = buildAnalysisPrompt(request);
    expect(user).toContain(request.pageText);
    expect(user).toContain("budget: 1.300 €");
    expect(user).toContain("1 Hund");
    expect(user).toContain("WBS: no");
    expect(user).toContain("move-in: 01.03.2027");
    expect(user).toContain("income to Kaltmiete: 3.8");
  });

  it("says what is missing from the profile", () => {
    const { user } = buildAnalysisPrompt({
      ...request,
      budgetWarmCents: undefined,
      moveIn: undefined,
      incomeRatioTenths: undefined,
    });
    expect(user).toContain("budget: not given");
    expect(user).toContain("move-in: not given");
    expect(user).toContain("income to Kaltmiete: not given");
  });

  it("leaves out the contact line when the contact has no name", () => {
    const { user } = buildAnalysisPrompt({
      ...request,
      listing: {
        ...request.listing,
        contactPerson: { lastName: "" },
      },
    });
    expect(user).not.toContain("Kontakt");
  });

  it("names the Kaution once", () => {
    const { system } = buildAnalysisPrompt(request);
    expect(system).not.toContain("the Kaution, the deposit");
    expect(system).toContain("the Kaution");
  });

  it("sets the rules", () => {
    const { system } = buildAnalysisPrompt(request);
    expect(system).toContain("Write in English");
    expect(system).toContain("Word estimates as estimates");
    expect(system).toContain("Say so when something is unknown");
    expect(system).toContain("No em dashes");
    expect(system).toContain("scam");
    expect(system).toContain("fraud");
    expect(system).toContain("never claim to have looked anything up");
    expect(system).toContain("Name what the profile does not say");
    expect(system).not.toMatch(/claude|anthropic/i);
  });

  it("is pure", () => {
    expect(buildAnalysisPrompt(request)).toEqual(buildAnalysisPrompt(request));
  });
});
