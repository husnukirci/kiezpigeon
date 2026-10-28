// Cents arithmetic. Money is integer cents end to end; only the UI layer
// formats it (see format.ts).
import type { Cents } from "./types";

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
