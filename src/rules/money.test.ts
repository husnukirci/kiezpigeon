import { describe, expect, it } from "vitest";
import { isCents, sumCents } from "./money";

describe("money", () => {
  it("sums cents", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([260000, 200000])).toBe(460000);
  });

  it("accepts only non-negative whole cents", () => {
    expect(isCents(0)).toBe(true);
    expect(isCents(118000)).toBe(true);
    expect(isCents(-1)).toBe(false);
    expect(isCents(1.5)).toBe(false);
    expect(isCents(Number.NaN)).toBe(false);
    expect(isCents(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isCents("100")).toBe(false);
  });
});
