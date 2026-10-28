import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatArea, formatDate, formatEuro, formatNumber } from "./format";

// German grouping is written out by hand so the output does not depend on
// the runtime's locale data: every case runs once with `Intl` present and
// once with it removed.
describe.each([
  ["with Intl", false],
  ["without Intl", true],
])("format %s", (_, removeIntl) => {
  beforeEach(() => {
    if (removeIntl) {
      vi.stubGlobal("Intl", undefined);
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs with Intl present or removed as the case says", () => {
    expect(typeof globalThis.Intl === "undefined").toBe(removeIntl);
  });

  it("groups thousands with dots and uses a decimal comma", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1180)).toBe("1.180");
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(62.5)).toBe("62,5");
    expect(formatNumber(-1300)).toBe("-1.300");
  });

  it("formats whole euros without decimals and cents with two", () => {
    expect(formatEuro(118000)).toBe("1.180 €");
    expect(formatEuro(9000)).toBe("90 €");
    expect(formatEuro(0)).toBe("0 €");
    expect(formatEuro(345050)).toBe("3.450,50 €");
    expect(formatEuro(345005)).toBe("3.450,05 €");
    expect(formatEuro(-26000)).toBe("-260 €");
  });

  it("formats areas with up to one decimal", () => {
    expect(formatArea(62)).toBe("62 m²");
    expect(formatArea(62.5)).toBe("62,5 m²");
    expect(formatArea(1050)).toBe("1.050 m²");
  });

  it("formats ISO dates as DD.MM.YYYY", () => {
    expect(formatDate("2027-03-01")).toBe("01.03.2027");
    expect(formatDate("2026-12-24")).toBe("24.12.2026");
  });

  it("rejects a string that is not an ISO date", () => {
    expect(() => formatDate("1.3.2027")).toThrow(RangeError);
  });
});
