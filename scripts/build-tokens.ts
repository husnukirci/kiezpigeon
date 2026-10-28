// Generates src/styles/tokens.css from design/tokens.json (ADR 7).
// Run with `npm run tokens`; scripts/build-tokens.test.ts fails when the
// committed CSS is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TOKENS_JSON = fileURLToPath(
  new URL("../design/tokens.json", import.meta.url),
);
export const TOKENS_CSS = fileURLToPath(
  new URL("../src/styles/tokens.css", import.meta.url),
);

const HEADER = "/* generated from design/tokens.json, do not edit */";

interface ValueToken {
  name: string;
  value: string;
}

interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

interface DesignTokens {
  colors: ValueToken[];
  spacing: ValueToken[];
  radius: ValueToken[];
  size: ValueToken[];
  families: Record<string, string>;
  typeStyles: { family: string; style: TypeStyle }[];
}

export function renderTokensCss(json: string): string {
  const tokens = parseTokens(JSON.parse(json));
  const lines = [HEADER, "", ":root {"];

  const groups: [string, ValueToken[]][] = [
    ["colour", tokens.colors],
    ["spacing", tokens.spacing],
    ["radius", tokens.radius],
    ["size", tokens.size],
  ];
  for (const [label, group] of groups) {
    lines.push(`  /* ${label} */`);
    for (const token of group) {
      lines.push(`  --${token.name}: ${token.value};`);
    }
  }
  lines.push("  /* font families */");
  for (const [name, stack] of Object.entries(tokens.families)) {
    lines.push(`  --font-${name}: ${stack};`);
  }
  lines.push("}");

  for (const { family, style } of tokens.typeStyles) {
    lines.push(
      "",
      `.type-${style.name} {`,
      `  font-family: var(--font-${family});`,
      `  font-size: ${style.fontSize};`,
      `  line-height: ${style.lineHeight};`,
      `  font-weight: ${style.fontWeight};`,
    );
    if (style.letterSpacing !== undefined) {
      lines.push(`  letter-spacing: ${style.letterSpacing};`);
    }
    lines.push("}");
  }

  return lines.join("\n") + "\n";
}

function parseTokens(raw: unknown): DesignTokens {
  const root = asRecord(raw, "root");
  const type = asRecord(root.type, "type");
  const families = asRecord(type.families, "type.families");

  return {
    colors: valueTokens(root.color, "color"),
    spacing: valueTokens(root.spacing, "spacing"),
    radius: valueTokens(root.radius, "radius"),
    size: valueTokens(root.size, "size"),
    families: Object.fromEntries(
      Object.entries(families).map(([name, stack]) => [
        name,
        asString(stack, `type.families.${name}`),
      ]),
    ),
    typeStyles: asArray(type.groups, "type.groups").flatMap((group, i) => {
      const g = asRecord(group, `type.groups[${i}]`);
      const family = asString(g.family, `type.groups[${i}].family`);
      return asArray(g.styles, `type.groups[${i}].styles`).map((s, j) => ({
        family,
        style: typeStyle(s, `type.groups[${i}].styles[${j}]`),
      }));
    }),
  };
}

function valueTokens(raw: unknown, path: string): ValueToken[] {
  const group = asRecord(raw, path);
  return asArray(group.tokens, `${path}.tokens`).map((t, i) => {
    const token = asRecord(t, `${path}.tokens[${i}]`);
    return {
      name: asString(token.name, `${path}.tokens[${i}].name`),
      value: asString(token.value, `${path}.tokens[${i}].value`),
    };
  });
}

function typeStyle(raw: unknown, path: string): TypeStyle {
  const s = asRecord(raw, path);
  const style: TypeStyle = {
    name: asString(s.name, `${path}.name`),
    fontSize: asString(s.fontSize, `${path}.fontSize`),
    lineHeight: asString(s.lineHeight, `${path}.lineHeight`),
    fontWeight: asNumber(s.fontWeight, `${path}.fontWeight`),
  };
  if (s.letterSpacing !== undefined) {
    style.letterSpacing = asString(s.letterSpacing, `${path}.letterSpacing`);
  }
  return style;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`tokens.json: ${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`tokens.json: ${path} must be an array`);
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`tokens.json: ${path} must be a string`);
  }
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number") {
    throw new Error(`tokens.json: ${path} must be a number`);
  }
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(TOKENS_CSS, renderTokensCss(readFileSync(TOKENS_JSON, "utf8")));
  console.log(`wrote ${TOKENS_CSS}`);
}
