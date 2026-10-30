// AI attribution the author's rules forbid in commit messages and PR
// descriptions: co-author trailers for an AI tool, the tool's footer and its
// robot. Used by commitlint (every local commit) and by CI on each PR's
// commits and description. Run directly, it checks the text in $PR_BODY.
import { fileURLToPath } from "node:url";

const PATTERNS: readonly RegExp[] = [
  /co-authored-by:.*\b(claude|anthropic|copilot|chatgpt|openai|gpt-\d|gemini)\b/i,
  /noreply@anthropic\.com/i,
  /generated with \[?claude/i,
  /\u{1F916}/u,
];

/** The lines of `text` that carry AI attribution, in order. */
export function findAttribution(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => PATTERNS.some((pattern) => pattern.test(line)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = findAttribution(process.env.PR_BODY ?? "");
  if (found.length > 0) {
    console.error("The PR description carries AI attribution; remove:");
    for (const line of found) console.error(`  ${line}`);
    process.exit(1);
  }
}
