// A hidden select counts only when a visible styled widget stands in for
// it; every other hidden field stays a possible spam trap (ADR 8, ADR 12).
import { describe, expect, it } from "vitest";
import { describeFields } from "./describe";

function visibility(html: string): boolean | undefined {
  const form = new DOMParser()
    .parseFromString(`<form>${html}</form>`, "text/html")
    .querySelector("form");
  if (!form) throw new Error("no form");
  return describeFields(form)[0]?.visible;
}

const HIDDEN_SELECT =
  '<select name="income" data-id="ss-1" aria-hidden="true" style="display: none;"><option>a</option></select>';

describe("describeFields on a select hidden behind a styled widget", () => {
  it("counts a select when its widget is visible", () => {
    expect(
      visibility(`${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1"></div>`),
    ).toBe(true);
  });

  it("does not count a hidden select with no widget", () => {
    expect(visibility(HIDDEN_SELECT)).toBe(false);
  });

  it("does not count a select whose widget is hidden too", () => {
    expect(
      visibility(
        `${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1" style="display: none;"></div>`,
      ),
    ).toBe(false);
    expect(
      visibility(
        `<div hidden>${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1"></div></div>`,
      ),
    ).toBe(false);
  });

  it("does not count a select beside another select's widget", () => {
    expect(
      visibility(`${HIDDEN_SELECT}<div class="ss-main" data-id="ss-2"></div>`),
    ).toBe(false);
  });

  it("does not count a select without an id beside an unpaired widget", () => {
    expect(
      visibility(
        '<select name="income" aria-hidden="true"></select><div class="ss-main"></div>',
      ),
    ).toBe(false);
  });

  it("does not count a hidden text input beside a widget", () => {
    expect(
      visibility(
        '<input name="trap" data-id="ss-1" aria-hidden="true" /><div class="ss-main" data-id="ss-1"></div>',
      ),
    ).toBe(false);
  });
});
