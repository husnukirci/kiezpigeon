// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderTokensCss, TOKENS_CSS, TOKENS_JSON } from "./build-tokens.ts";

describe("tokens.css", () => {
  it("matches what design/tokens.json generates (run `npm run tokens`)", () => {
    const expected = renderTokensCss(readFileSync(TOKENS_JSON, "utf8"));
    expect(readFileSync(TOKENS_CSS, "utf8")).toBe(expected);
  });

  it("has one custom property per colour, spacing, radius and size token", () => {
    const css = renderTokensCss(readFileSync(TOKENS_JSON, "utf8"));
    expect(css).toContain("--night-800: #12175a;");
    expect(css).toContain("--space-4: 16px;");
    expect(css).toContain("--radius-xl: 22px;");
    expect(css).toContain("--tap-min: 44px;");
  });

  it("has one class per type style", () => {
    const css = renderTokensCss(readFileSync(TOKENS_JSON, "utf8"));
    expect(css).toMatch(/\.type-title-xl \{[^}]*font-size: 28px;/);
    expect(css).toMatch(/\.type-body \{[^}]*line-height: 22px;/);
  });

  it("names the broken path when tokens.json is malformed", () => {
    expect(() => renderTokensCss('{"color": {"tokens": [{"name": 1}]}}')).toThrow(
      "tokens.json: type must be an object",
    );
  });
});
