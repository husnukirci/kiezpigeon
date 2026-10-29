// Parsers for the German text listing pages show: money, numbers, dates
// and contact names. Each returns undefined for text it cannot read, so an
// adapter can name the field in `missing` instead of guessing.
import type { Cents, ContactPerson, IsoDate } from "../rules/types";

/** `750 €`, `+ 1.180,50 €`, `1180` → cents. */
export function parseEuroText(text: string): Cents | undefined {
  const match = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/.exec(text);
  if (!match) return undefined;
  const [, whole = "", fraction = ""] = match;
  return (
    Number(whole.replaceAll(".", "")) * 100 + Number(fraction.padEnd(2, "0"))
  );
}

/** `44 m²`, `62,5 m²`, `2,5` → a number. */
export function parseNumberText(text: string): number | undefined {
  const match = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?/.exec(text);
  if (!match) return undefined;
  const [, whole = "", fraction] = match;
  return Number(
    `${whole.replaceAll(".", "")}${fraction ? `.${fraction}` : ""}`,
  );
}

/** `01.03.2027` or `1.3.2027` anywhere in the text → `2027-03-01`. */
export function parseGermanDate(text: string): IsoDate | undefined {
  const match = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(text);
  if (!match) return undefined;
  const [, day = "", month = "", year = ""] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const SALUTATIONS = new Set(["Frau", "Herr"]);
const TITLES = /^(Dr\.|Prof\.|Dipl\.-\w+\.?)$/;
// A company is not a person to greet by name.
const COMPANY =
  /\b(GmbH|mbH|AG|SE|KG|OHG|eG|e\.\s?G\.|GbR|UG|Immobilien|Verwaltung|Hausverwaltung|Wohnen|Wohnungsbau|Genossenschaft|Makler|Team|Kundenservice)\b/i;

/** `Frau Dr. Anna Weber` → salutation, first name and surname. */
export function parseContactName(text: string): ContactPerson | undefined {
  const name = text.replace(/\s+/g, " ").trim();
  if (name === "" || COMPANY.test(name)) return undefined;
  const words = name.split(" ").filter((word) => !TITLES.test(word));
  const salutation = words[0];
  const hasSalutation = salutation !== undefined && SALUTATIONS.has(salutation);
  const rest = hasSalutation ? words.slice(1) : words;
  const lastName = rest.at(-1);
  if (lastName === undefined) return undefined;
  const firstName = rest.slice(0, -1).join(" ");
  return {
    ...(hasSalutation && { salutation: salutation as "Frau" | "Herr" }),
    ...(firstName && { firstName }),
    lastName,
  };
}
