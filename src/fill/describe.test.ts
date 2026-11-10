// A hidden select counts only when a visible styled widget stands in for
// it; every other hidden field stays a possible spam trap (ADR 8, ADR 12).
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeFields } from "./describe";

function formWith(html: string): HTMLFormElement {
  const form = new DOMParser()
    .parseFromString(`<form>${html}</form>`, "text/html")
    .querySelector("form");
  if (!form) throw new Error("no form");
  return form;
}

function visibility(html: string): boolean | undefined {
  return describeFields(formWith(html))[0]?.visible;
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

  it("counts a select when a second widget, drawn right after its own, is visible", () => {
    expect(
      visibility(
        `${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1" style="display: none;"></div><div class="ss-main" data-id="ss-9"></div>`,
      ),
    ).toBe(true);
  });

  it("does not count a select when every widget beside it is hidden", () => {
    expect(
      visibility(
        `${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1" style="display: none;"></div><div class="ss-main" data-id="ss-9" style="display: none;"></div>`,
      ),
    ).toBe(false);
  });

  it("does not count a select whose own widget is hidden, beside something else visible", () => {
    expect(
      visibility(
        `${HIDDEN_SELECT}<div class="ss-main" data-id="ss-1" style="display: none;"></div><div data-id="ss-9">not a widget</div>`,
      ),
    ).toBe(false);
  });

  it("does not count a select with no widget of its own, whatever stands behind", () => {
    expect(
      visibility(
        `${HIDDEN_SELECT}<div class="ss-main" data-id="ss-2" style="display: none;"></div><div class="ss-main" data-id="ss-3"></div>`,
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

describe("describeFields on fields hidden by style", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it.each([
    '<input name="trap" style="opacity: 0">',
    '<input name="trap" style="visibility: hidden">',
    '<div style="opacity: 0"><input name="trap"></div>',
  ])("does not count %s", (html) => {
    expect(visibility(html)).toBe(false);
  });

  it("does not count a field placed left of or above the page", () => {
    const form = formWith('<input name="trap">');
    document.body.append(form);
    const input = form.querySelector("input") as HTMLInputElement; // just parsed above
    input.getBoundingClientRect = () => new DOMRect(-5000, 10, 100, 20);
    expect(describeFields(form)[0]?.visible).toBe(false);
  });

  it("counts a field scrolled out of view", () => {
    const form = formWith('<input name="name">');
    document.body.append(form);
    const input = form.querySelector("input") as HTMLInputElement; // just parsed above
    input.getBoundingClientRect = () => new DOMRect(10, -800, 100, 20);
    vi.stubGlobal("scrollY", 1200);
    expect(describeFields(form)[0]?.visible).toBe(true);
  });
});
