// Turns a listing page saved from Chrome into a fixture (CLAUDE.md rule 6):
// strips scripts, styles, inline SVG, frames, images and tracking
// attributes, applies a replacement list of real → invented values, and
// reports what still looks like personal data for a manual pass.
//
//   node scripts/reduce-fixture.ts <saved.html> <fixture.html> [replacements.json]
//
// The replacement list maps each real value to its invented stand-in. It
// holds real data, so it lives next to the saved page, outside the repo.
import { readFileSync, writeFileSync } from "node:fs";

export const SCRUB_MARK =
  "<!-- scrubbed: names, phones, emails, addresses, ids replaced -->";

/** Attributes worth keeping: what adapters and form filling read. */
const KEEP_ATTRIBUTES = new Set([
  "id",
  "class",
  "data-qa",
  "data-testid",
  "name",
  "type",
  "for",
  "value",
  "placeholder",
  "autocomplete",
  "aria-label",
  "aria-labelledby",
  "role",
  "href",
  "content",
  "property",
  "itemprop",
  "lang",
  "disabled",
  "required",
  "checked",
  "selected",
  "hidden",
]);

const TRACKING_ID = /\d{6,}|[0-9a-f]{8}-[0-9a-f]{4}-/i;

export function reduce(html: string): string {
  let out = html;
  // Removed whole, with what they contain.
  for (const tag of [
    "script",
    "style",
    "svg",
    "iframe",
    "noscript",
    "template",
    // The site's own header holds the signed-in user's name and customer
    // number; the adapters read nothing in it, nor in the footer or menus.
    "header",
    "footer",
    "nav",
    "s24-ad-targeting",
  ]) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), "");
  }
  // Removed where they stand; they have no content.
  out = out.replace(/<(link|meta|img|source|base)\b[^>]*>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(
    /<([a-z][\w-]*)((?:\s+[^\s=>]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi,
    (_, tag: string, attributes: string, selfClosing: string) =>
      `<${tag}${keptAttributes(attributes)}${selfClosing ? " /" : ""}>`,
  );
  // Links lead nowhere: a fixture never points back at the site.
  out = out.replace(/\shref="[^"]*"/g, ' href="#"');
  out = out.replace(/\n\s*\n+/g, "\n");
  return out.trim();
}

function keptAttributes(attributes: string): string {
  const kept: string[] = [];
  for (const match of attributes.matchAll(
    /([^\s=>]+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g,
  )) {
    const [whole, name] = match;
    if (!name || !KEEP_ATTRIBUTES.has(name.toLowerCase())) continue;
    // Ad slots and tracking beacons carry their token in the id.
    if (name === "id" && TRACKING_ID.test(match[2] ?? "")) continue;
    kept.push(whole);
  }
  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

export function replaceAll(
  html: string,
  replacements: Record<string, string>,
): string {
  let out = html;
  // Longest first, so "Musterstraße 12" goes before "Musterstraße".
  const entries = Object.entries(replacements).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [real, invented] of entries) {
    out = out.split(real).join(invented);
  }
  return out;
}

/** Text that still looks like personal data, for a human to check. */
export function suspicious(html: string): string[] {
  const patterns: [string, RegExp][] = [
    ["email", /[\w.+-]+@[\w-]+\.[\w.]+/g],
    ["phone", /(?:\+49|0)[\d\s/-]{7,}\d/g],
    ["long number (id?)", /\b\d{8,}\b/g],
    [
      "street",
      /[A-ZÄÖÜ][\wäöüß-]*(?:straße|str\.|weg|allee|platz|damm|ufer)\s*\d+/g,
    ],
    ["key", /sk-ant[\w-]*/g],
  ];
  const found = new Set<string>();
  for (const [label, pattern] of patterns) {
    for (const match of html.matchAll(pattern))
      found.add(`${label}: ${match[0]}`);
  }
  return [...found];
}

function main(): void {
  const [input, output, replacementsFile] = process.argv.slice(2);
  if (!input || !output) {
    console.error(
      "usage: node scripts/reduce-fixture.ts <saved.html> <fixture.html> [replacements.json]",
    );
    process.exit(1);
  }
  const replacements = replacementsFile
    ? (JSON.parse(readFileSync(replacementsFile, "utf8")) as Record<
        string,
        string
      >)
    : {};
  const html = replaceAll(reduce(readFileSync(input, "utf8")), replacements);
  writeFileSync(output, `${SCRUB_MARK}\n${html}\n`);
  const left = suspicious(html);
  console.log(`${output}: ${html.length} bytes`);
  for (const line of left) console.log(`  check ${line}`);
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) main();
