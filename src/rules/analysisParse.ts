import { ANALYSIS_HEADINGS, type AnalysisHeading } from "./analysisPrompt";

export interface AnalysisSection {
  heading: AnalysisHeading | "Analysis";
  text: string;
}

export const ANALYSIS_TEXT_MAX = 6_000;

type LineKind =
  | { kind: "known"; heading: AnalysisHeading }
  | { kind: "unknown" }
  | { kind: "text" };

function classifyLine(line: string): LineKind {
  const trimmed = line.trim();
  const hashed = /^#+\s*/.test(trimmed);
  const bold = /^\*\*.+\*\*:?$/.test(trimmed);
  if (!hashed && !bold) return { kind: "text" };
  const name = trimmed
    .replace(/^#+\s*/, "")
    .replace(/^\*\*/, "")
    .replace(/:$/, "")
    .replace(/\*\*$/, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
  const heading = ANALYSIS_HEADINGS.find((h) => h.toLowerCase() === name);
  return heading ? { kind: "known", heading } : { kind: "unknown" };
}

/** An unknown heading is shown as plain text, without its markdown marker. */
function stripHeadingMarkers(line: string): string {
  return line
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+)\*\*(:?)$/, "$1$2");
}

function replaceEmDashes(text: string): string {
  return text
    .replace(/[ \t]*—[ \t]*/g, ", ")
    .replace(/, +\n/g, ",\n")
    .trimEnd();
}

function capSections(sections: AnalysisSection[]): AnalysisSection[] {
  const kept: AnalysisSection[] = [];
  let remaining = ANALYSIS_TEXT_MAX;
  for (const section of sections) {
    if (section.text.length <= remaining) {
      kept.push(section);
      remaining -= section.text.length;
      continue;
    }
    // Leave one character for the ellipsis, then back up to a word boundary.
    const room = Math.max(remaining - 1, 0);
    const midWord = /\S/.test(section.text.charAt(room));
    const head = section.text.slice(0, room);
    const cut = midWord ? head.replace(/\s*\S*$/, "") : head;
    const text = cut.trimEnd();
    if (text) kept.push({ heading: section.heading, text: `${text}…` });
    break;
  }
  return kept;
}

export function parseAnalysis(text: string): AnalysisSection[] {
  const raw: { heading: AnalysisSection["heading"]; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const kind = classifyLine(line);
    if (kind.kind === "known") {
      raw.push({ heading: kind.heading, lines: [] });
      continue;
    }
    let current = raw[raw.length - 1];
    if (!current) {
      current = { heading: "Analysis", lines: [] };
      raw.push(current);
    }
    current.lines.push(
      kind.kind === "unknown" ? stripHeadingMarkers(line) : line,
    );
  }
  const sections = raw
    .map((s) => ({
      heading: s.heading,
      text: replaceEmDashes(s.lines.join("\n").trim()),
    }))
    .filter((s) => s.text !== "");
  return capSections(sections);
}
