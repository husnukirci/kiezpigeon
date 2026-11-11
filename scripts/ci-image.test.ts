// The e2e job runs in Playwright's image (ADR 5 amendment). The image's
// browser must be the one the installed Playwright expects, so an upgrade
// that forgets the tag fails here and not in a browser launch.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const installed = (
  JSON.parse(
    readFileSync("node_modules/@playwright/test/package.json", "utf8"),
  ) as { version: string }
).version;

describe("the e2e job's browser image", () => {
  it("is the Playwright image for the installed version", () => {
    const image = /image:\s*(\S+)/.exec(workflow)?.[1];
    expect(
      image,
      "Change the image tag in .github/workflows/ci.yml when @playwright/test changes",
    ).toBe(`mcr.microsoft.com/playwright:v${installed}-noble`);
  });

  it("installs no browser at run time", () => {
    expect(workflow).not.toContain("playwright install");
  });
});
