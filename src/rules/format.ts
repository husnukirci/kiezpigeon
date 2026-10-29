// German number, money, area and date formatting for the UI. Written by
// hand rather than with `Intl` so the output is the same whatever locale
// data the runtime ships, and uses a plain space before the unit.
import type { Availability, Cents, IsoDate } from "./types";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** `1180` → `1.180`, `62.5` → `62,5`. Up to `maxDecimals` decimals. */
export function formatNumber(value: number, maxDecimals = 2): string {
  const sign = value < 0 ? "-" : "";
  const [whole = "0", fraction = ""] = Math.abs(value)
    .toFixed(maxDecimals)
    .split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return sign + groupThousands(whole) + (trimmed ? `,${trimmed}` : "");
}

/** `118000` → `1.180 €`, `345050` → `3.450,50 €`. */
export function formatEuro(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = groupThousands(String(Math.floor(abs / 100)));
  const rest = abs % 100;
  const decimals = rest === 0 ? "" : `,${String(rest).padStart(2, "0")}`;
  return `${sign}${euros}${decimals} €`;
}

/** `62` → `62 m²`, `62.5` → `62,5 m²`. */
export function formatArea(squareMetres: number): string {
  return `${formatNumber(squareMetres, 1)} m²`;
}

/** `2027-03-01` → `01.03.2027`. */
export function formatDate(iso: IsoDate): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new RangeError(`Not an ISO date: ${iso}`);
  }
  const [, year, month, day] = match;
  return `${day ?? ""}.${month ?? ""}.${year ?? ""}`;
}

/** `0` → `EG`, `2` → `2. OG`, below ground → `UG`. */
export function formatFloor(floor: number): string {
  if (floor < 0) return "UG";
  if (floor === 0) return "EG";
  return `${floor}. OG`;
}

/** `Free from 01.03.2027`, `Free now`, `Free by arrangement`. */
export function formatAvailability(availability: Availability): string {
  switch (availability.kind) {
    case "date":
      return `Free from ${formatDate(availability.date)}`;
    case "immediately":
      return "Free now";
    case "by_arrangement":
      return "Free by arrangement";
  }
}
