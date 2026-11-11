// Parsers for the text listing pages show: money, numbers, dates and contact
// names, in German, and in English where ImmoScout24 translates its page.
// Each returns undefined for text it cannot read, so an adapter can name the
// field in `missing` instead of guessing.
import type {
  Availability,
  Cents,
  ContactPerson,
  IsoDate,
} from "../rules/types";

/** `750 €`, `+ 1.180,50 €`, `1180` → cents. */
export function parseEuroText(text: string): Cents | undefined {
  const match = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/.exec(text);
  if (!match) return undefined;
  const [, whole = "", fraction = ""] = match;
  return (
    Number(whole.replaceAll(".", "")) * 100 + Number(fraction.padEnd(2, "0"))
  );
}

/** `Erdgeschoss`, `2. OG`, `1 von 5`, `Souterrain`, `Basement` → the floor. */
export function parseFloor(text: string): number | undefined {
  const t = text.trim();
  if (/^(EG|Erdgescho(ss|ß)|Ground floor)(?![\p{L}])/iu.test(t)) return 0;
  if (
    /^(\d+\.?\s*)?(UG|Untergescho(ss|ß)|Souterrain|Basement)(?![\p{L}])/iu.test(
      t,
    )
  ) {
    return -1;
  }
  const match = /^(-?\d+)(?!\d)/.exec(t);
  return match ? Number(match[1]) : undefined;
}

const RENT_COUNT =
  /(\d+(?:,\d+)?)\s*(?:[x×]\s*)?(?:Nettokaltmieten?|Monatskaltmieten?|Kaltmieten?|Monatsmieten?|MM|NKM|monthly rents?)(?![\p{L}])/iu;
// A number written directly against a currency sign or code.
const STATED_AMOUNT =
  /(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*(?:€|EUR(?![\p{L}]))/u;

/**
 * `3.540 €`, `1000` → cents; `3 Kaltmieten`, `2,5 NKM` → that many of the
 * listing's Kaltmiete, or undefined when the Kaltmiete is not known. A stated
 * amount wins over a count: `3 Kaltmieten (3.540 €)` is 3.540 €.
 */
export function parseDepositText(
  text: string,
  kaltmieteCents: Cents | undefined,
): Cents | undefined {
  const stated = STATED_AMOUNT.exec(text)?.[0];
  if (stated !== undefined) return parseEuroText(stated);
  const count = RENT_COUNT.exec(text)?.[1];
  if (count === undefined) return parseEuroText(text);
  if (kaltmieteCents === undefined) return undefined;
  return Math.round(Number(count.replace(",", ".")) * kaltmieteCents);
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

/**
 * The number in the English page's text as one token, whole or not at all,
 * so `1.105` (a sum written the German way) is refused rather than read as
 * 1.105.
 */
function englishNumber(text: string): number | undefined {
  const token = /\d[\d.,]*\d|\d/.exec(text)?.[0];
  if (token === undefined) return undefined;
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(token);
  if (!match) return undefined;
  const [, whole = "", fraction] = match;
  return Number(
    `${whole.replaceAll(",", "")}${fraction ? `.${fraction}` : ""}`,
  );
}

/** `€865`, `+ €240`, `€1,180.50` → cents. */
export function parseEnglishEuro(text: string): Cents | undefined {
  const euros = englishNumber(text);
  return euros === undefined ? undefined : Math.round(euros * 100);
}

/** `60.13 m²`, `2.5` → a number. */
export function parseEnglishNumber(text: string): number | undefined {
  return englishNumber(text);
}

/** `01.11.2025`, `immediately`, `by arrangement` → when the flat is free. */
export function parseEnglishAvailability(
  text: string,
): Availability | undefined {
  const date = parseGermanDate(text);
  if (date) return { kind: "date", date };
  if (/immediately/i.test(text)) return { kind: "immediately" };
  if (/arrangement/i.test(text)) return { kind: "by_arrangement" };
  return undefined;
}

/** `01.03.2027` or `1.3.2027` anywhere in the text → `2027-03-01`. */
export function parseGermanDate(text: string): IsoDate | undefined {
  const match = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(text);
  if (!match) return undefined;
  const [, day = "", month = "", year = ""] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** `01.03.2027`, `ab sofort`, `nach Vereinbarung` → when the flat is free. */
export function parseAvailability(text: string): Availability | undefined {
  const date = parseGermanDate(text);
  if (date) return { kind: "date", date };
  if (/sofort/i.test(text)) return { kind: "immediately" };
  if (/vereinbarung|absprache/i.test(text)) return { kind: "by_arrangement" };
  return undefined;
}

const SALUTATIONS = new Set(["Frau", "Herr"]);
const TITLES = /^(Dr\.|Prof\.|Dipl\.-\w+\.?)$/;
// A company is not a person to greet by name. Legal forms are whole tokens
// and case-sensitive, so a short surname ("Se", "Ag") is not one; trade words
// count inside a word ("Musterhausverwaltung") whatever the case.
const LEGAL_FORM =
  /(?<![\p{L}.])(GmbH|mbH|AG|SE|KG|OHG|eG|e\.\s?G\.|GbR|UG)(?![\p{L}])/u;
const TRADE_WORD =
  /immobilien|verwaltung|wohnungsbau|genossenschaft|vermietung|makler|kundenservice|team(?![\p{L}])|(?<![\p{L}])wohnen(?![\p{L}])/iu;
const COMPANY = {
  test: (name: string) => LEGAL_FORM.test(name) || TRADE_WORD.test(name),
};

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
