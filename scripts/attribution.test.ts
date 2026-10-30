// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findAttribution } from "./attribution.ts";

// Built from parts so this file is not itself a commit message or PR body
// the check would flag if pasted somewhere.
const ROBOT = String.fromCodePoint(0x1f916);
const TRAILER = ["Co-Authored-By: Claude Opus 5.5", "<noreply@anthropic.com>"];

describe("findAttribution", () => {
  it("finds an AI co-author trailer", () => {
    expect(findAttribution(`feat: x\n\n${TRAILER.join(" ")}`)).toEqual([
      TRAILER.join(" "),
    ]);
  });

  it("finds a co-author trailer for other AI tools, in any case", () => {
    expect(
      findAttribution("co-authored-by: GitHub Copilot <x@y>"),
    ).toHaveLength(1);
    expect(findAttribution("Co-authored-by: ChatGPT <x@y>")).toHaveLength(1);
  });

  it("finds the tool's footer and its robot", () => {
    const footer = `${ROBOT} Generated with [Claude Code](https://claude.com/claude-code)`;
    expect(findAttribution(`Body\n\n${footer}`)).toEqual([footer]);
    expect(findAttribution(`Done ${ROBOT}`)).toHaveLength(1);
  });

  it("finds the noreply address on its own", () => {
    expect(findAttribution("Signed: noreply@anthropic.com")).toHaveLength(1);
  });

  it("leaves a human co-author and ordinary mentions of Claude alone", () => {
    expect(
      findAttribution(
        "Co-Authored-By: Erika Beispiel <erika@example.org>\n" +
          "The letter call goes to Claude; `src/claude/` holds the client.",
      ),
    ).toEqual([]);
  });
});
