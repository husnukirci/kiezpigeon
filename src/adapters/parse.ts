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

// A count of rents: `3 Kaltmieten`, `2.5 monthly rents`, `3-fache
// Kaltmiete`, `3 x Kaltmiete`, `3 Netto-Kaltmieten`, `3 KM`, `3 months' rent`.
const RENT_COUNT =
  /(\d+(?:[.,]\d+)?)\s*(?:-?fache\s+|[x×]\s*)?(?:(?:Monats)?(?:Netto-?)?Kaltmieten?|(?:Monats|Netto)?Mieten?|MM|NKM|KM|monthly rents?|months?['’]? rents?)(?![\p{L}])/iu;
// A number written directly against a currency sign, code or word.
const AMOUNT =
  /(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?\s*(?:€|EUR(?![\p{L}])|Euro(?![\p{L}]))/u;
// An amount times a count: `1.180 € x 3`.
const AMOUNT_TIMES = new RegExp(
  `(${AMOUNT.source})\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)(?![\\d\\p{L}])`,
  "u",
);
// A small bare number followed by a word: a count of something unknown.
// A grouped number ("1.500 Euro") is not one.
const UNKNOWN_COUNT = /^\D*?(\d{1,2})(?:[.,]\d{1,2})?\s*\p{L}/u;

function countOf(digits: string): number {
  return Number(digits.replace(",", "."));
}

/**
 * `3.540 €`, `1000` → cents; `3 Kaltmieten`, `2,5 NKM` → that many of the
 * listing's Kaltmiete, or undefined when the Kaltmiete is not known. With
 * both a count and a stated amount the larger wins: `3 NKM zzgl. 100 €
 * Schlüsselpfand` is three rents, `3 Kaltmieten (3.540 €)` is 3.540 €. A
 * small number before a word the parser does not know is never euros.
 */
export function parseDepositText(
  text: string,
  kaltmieteCents: Cents | undefined,
): Cents | undefined {
  const times = AMOUNT_TIMES.exec(text);
  if (times) {
    const amount = parseEuroText(times[1] ?? "");
    const factor = countOf(times[2] ?? "");
    if (amount !== undefined) return Math.round(amount * factor);
  }
  const statedText = AMOUNT.exec(text)?.[0];
  const stated =
    statedText === undefined ? undefined : parseEuroText(statedText);
  const count = RENT_COUNT.exec(text)?.[1];
  const counted =
    count === undefined || kaltmieteCents === undefined
      ? undefined
      : Math.round(countOf(count) * kaltmieteCents);
  if (stated !== undefined || counted !== undefined) {
    return Math.max(stated ?? 0, counted ?? 0);
  }
  if (count !== undefined) return undefined;
  const unknown = UNKNOWN_COUNT.exec(text)?.[1];
  if (unknown !== undefined && Number(unknown) < 50) return undefined;
  return parseEuroText(text);
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
// A company is not a person to greet by name. GmbH, mbH, OHG, GbR and KG
// are whole tokens in any case. The short forms AG, SE, UG, eG and e.G. are
// case-sensitive, so a short surname ("Frau Se", "Herr Ag") is not one,
// unless, in any case, it ends a name of two or more words with no Frau or
// Herr before it ("Muster Bau Ag"). Trade words count inside a word
// ("Musterhausverwaltung") whatever the case.
const LEGAL_FORM_ANY_CASE = /(?<![\p{L}.])(GmbH|mbH|OHG|GbR|KG)(?![\p{L}])/iu;
const SHORT_LEGAL_FORM = /(?<![\p{L}.])(AG|SE|UG|eG|e\.\s?G\.)(?![\p{L}])/u;
const SHORT_LEGAL_FORM_WORD = /^(AG|SE|UG|EG|E\.G\.)$/i;
const TRADE_WORD =
  /immobilien|verwaltung|wohnungsbau|genossenschaft|vermietung|makler|kundenservice|team(?![\p{L}])|(?<![\p{L}])wohnen(?![\p{L}])/iu;

function isCompany(name: string): boolean {
  if (
    LEGAL_FORM_ANY_CASE.test(name) ||
    SHORT_LEGAL_FORM.test(name) ||
    TRADE_WORD.test(name)
  ) {
    return true;
  }
  const words = name.split(" ");
  const first = words[0] ?? "";
  return (
    words.length >= 2 &&
    !SALUTATIONS.has(first) &&
    SHORT_LEGAL_FORM_WORD.test(words.at(-1) ?? "")
  );
}

/** `Frau Dr. Anna Weber` → salutation, first name and surname. */
export function parseContactName(text: string): ContactPerson | undefined {
  const name = text.replace(/\s+/g, " ").trim();
  if (name === "" || isCompany(name)) return undefined;
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
