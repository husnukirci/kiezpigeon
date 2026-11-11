import { describe, expect, it } from "vitest";

import { ANALYSIS_HEADINGS } from "./analysisPrompt";
import { ANALYSIS_TEXT_MAX, parseAnalysis } from "./analysisParse";

const full = ANALYSIS_HEADINGS.map((h) => `## ${h}\n  Text for ${h}.  \n`).join(
  "\n",
);

describe("parseAnalysis", () => {
  it("splits by the known headings in order", () => {
    const sections = parseAnalysis(full);
    expect(sections.map((s) => s.heading)).toEqual([...ANALYSIS_HEADINGS]);
    expect(sections[2]).toEqual({ heading: "Price", text: "Text for Price." });
  });

  it("drops empty sections", () => {
    const sections = parseAnalysis(
      "## What this is\nA flat.\n\n## The area\n\n## Price\nFair.",
    );
    expect(sections.map((s) => s.heading)).toEqual(["What this is", "Price"]);
  });

  it("replaces em dashes", () => {
    const sections = parseAnalysis(
      "## Price\nGut — aber teuer —\nund dann—nichts.",
    );
    expect(sections[0]?.text).toBe("Gut, aber teuer,\nund dann, nichts.");
    for (const s of sections) expect(s.text).not.toContain("—");
  });

  it("keeps the en dash in ranges", () => {
    expect(parseAnalysis("## Price\n1.100–1.200 €")[0]?.text).toBe(
      "1.100–1.200 €",
    );
  });

  it("shows a text without headings whole", () => {
    expect(parseAnalysis("Just some words.")).toEqual([
      { heading: "Analysis", text: "Just some words." },
    ]);
  });

  it("returns nothing for blank text", () => {
    expect(parseAnalysis("  \n ")).toEqual([]);
  });

  it("folds an unknown heading into the section before it", () => {
    const sections = parseAnalysis(
      "## Price\nFair.\n## Bonus\nExtra.\n## For you\nGood.",
    );
    expect(sections).toEqual([
      { heading: "Price", text: "Fair.\nBonus\nExtra." },
      { heading: "For you", text: "Good." },
    ]);
  });

  it("folds a bold unknown heading without its markers", () => {
    const sections = parseAnalysis("## Price\nFair.\n**Bonus:**\nExtra.");
    expect(sections).toEqual([
      { heading: "Price", text: "Fair.\nBonus:\nExtra." },
    ]);
  });

  it("keeps an unknown heading before any known one in an Analysis section", () => {
    const sections = parseAnalysis("## Intro\nHello.\n## Price\nFair.");
    expect(sections).toEqual([
      { heading: "Analysis", text: "Intro\nHello." },
      { heading: "Price", text: "Fair." },
    ]);
  });

  it("accepts headings with bold or a colon", () => {
    const sections = parseAnalysis(
      "**Price:**\nFair.\n### The area\nQuiet.\n**For you**\nGood.",
    );
    expect(sections.map((s) => s.heading)).toEqual([
      "Price",
      "The area",
      "For you",
    ]);
  });

  it("matches headings case-insensitively", () => {
    expect(parseAnalysis("## PRICE\nFair.")[0]?.heading).toBe("Price");
  });

  it("caps the length, cut at a word boundary", () => {
    const words = "wort ".repeat(2_000);
    const sections = parseAnalysis(
      `## Price\n${words}\n## For you\nNever shown.`,
    );
    const total = sections.reduce((n, s) => n + s.text.length, 0);
    expect(total).toBeLessThanOrEqual(ANALYSIS_TEXT_MAX);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.text.endsWith("wort…")).toBe(true);
  });
});
