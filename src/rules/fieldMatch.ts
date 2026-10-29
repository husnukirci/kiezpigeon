// Form field matching: classify each field of a contact form from its
// plain-data description, pair it with a profile value or the letter, and
// score "X of Y matched". Consent and privacy fields never get a value.
import { moveInDateOf } from "./letterPrompt";
import { sumCents } from "./money";
import type {
  FieldKind,
  FieldMapping,
  FieldValue,
  FormField,
  Profile,
} from "./types";

const AUTOCOMPLETE: Record<string, FieldKind> = {
  "honorific-prefix": "salutation",
  "given-name": "firstName",
  "family-name": "lastName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "street-address": "street",
  "address-line1": "street",
  "postal-code": "postcode",
  "address-level2": "city",
};

/** Matches `source` only as a whole word, not inside another word. */
function word(source: string): string {
  return `(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`;
}

function pattern(parts: { within?: string; whole?: string }): RegExp {
  const sources = [parts.within, parts.whole && word(parts.whole)].filter(
    Boolean,
  );
  return new RegExp(sources.join("|"), "u");
}

// Checked in order; the first match wins. `within` matches inside longer
// German compounds (`Haushaltsnettoeinkommen`), `whole` only as a word
// (`ort` but not `Sortierung`).
const KEYWORDS: [Exclude<FieldKind, "unknown">, RegExp][] = [
  [
    "consent",
    pattern({
      within:
        "datenschutz|privacy|consent|willig|einverstanden|newsletter|akzeptier|zustimm",
      whole: "agb|terms",
    }),
  ],
  [
    "salutation",
    pattern({ within: "anrede|salutation|geschlecht", whole: "gender" }),
  ],
  ["email", pattern({ within: "e ?mail" })],
  ["phone", pattern({ within: "telefon|phone|handy|mobil", whole: "tel" })],
  [
    "firstName",
    pattern({ within: "vorname|first ?name|given ?name|forename" }),
  ],
  [
    "lastName",
    pattern({
      within: "nachname|familienname|last ?name|family ?name|surname",
    }),
  ],
  ["street", pattern({ within: "stra(?:ss|ß)e|street", whole: "str" })],
  [
    "houseNumber",
    pattern({ within: "hausnummer|hausnr|house ?(?:number|no)", whole: "nr" }),
  ],
  [
    "postcode",
    pattern({ within: "postleitzahl|zip|postal|post ?code", whole: "plz" }),
  ],
  ["city", pattern({ within: "wohnort|city|town", whole: "ort|stadt" })],
  [
    "message",
    pattern({
      within:
        "nachricht|message|anschreiben|mitteilung|kommentar|comment|anfrage",
    }),
  ],
  ["adults", pattern({ within: "erwachsene|adult" })],
  ["children", pattern({ within: "kinder|children", whole: "kind|kids?" })],
  ["pets", pattern({ within: "haustier|tierhaltung", whole: "pets?|tiere" })],
  ["smoker", pattern({ within: "raucher|smok" })],
  [
    "income",
    pattern({ within: "einkommen|income|gehalt|salary", whole: "netto" }),
  ],
  [
    "employment",
    pattern({
      within:
        "beruf|beschäftigung|employment|occupation|arbeitsverhältnis|profession",
      whole: "job",
    }),
  ],
  ["moveInDate", pattern({ within: "einzug|move ?in|bezugstermin|moving" })],
  ["wbs", pattern({ within: "wohnberechtigungsschein", whole: "wbs" })],
];

const CAPTCHA = /captcha/u;
const NON_SMOKER = /nichtraucher|non ?smok/u;
const NOT_COUNTED_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "password",
]);

/** Name, id, label and placeholder as lower-case words. */
function haystack(field: FormField): string {
  return [field.name, field.id, field.label, field.placeholder]
    .filter((part): part is string => part !== undefined)
    .join(" ")
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matches(kind: FieldKind, hay: string): boolean {
  return KEYWORDS.some(([k, re]) => k === kind && re.test(hay));
}

export function classifyField(field: FormField): FieldKind {
  const fromAutocomplete = field.autocomplete
    ? AUTOCOMPLETE[field.autocomplete.trim().toLowerCase()]
    : undefined;
  if (fromAutocomplete) return fromAutocomplete;

  const hay = haystack(field);
  const fromKeywords = KEYWORDS.find(([, re]) => re.test(hay));
  if (fromKeywords) return fromKeywords[0];

  switch (field.type) {
    case "email":
      return "email";
    case "tel":
      return "phone";
    case "textarea":
      return "message";
    default:
      return "unknown";
  }
}

/** Whether a field counts toward Y, the fields a person would fill. */
function isFillable(field: FormField): boolean {
  return (
    field.visible &&
    !field.disabled &&
    !NOT_COUNTED_TYPES.has(field.type) &&
    !CAPTCHA.test(haystack(field))
  );
}

function valueFor(
  kind: FieldKind,
  field: FormField,
  profile: Profile,
  letter: string,
): FieldValue | undefined {
  const applicant = profile.applicants[0];
  const { contact, household } = profile;
  const hay = haystack(field);
  switch (kind) {
    case "firstName":
      return applicant?.firstName;
    case "lastName":
      return applicant?.lastName;
    case "email":
      return contact.email;
    case "phone":
      return contact.phone;
    case "street":
      return matches("houseNumber", hay)
        ? `${contact.street} ${contact.houseNumber}`.trim()
        : contact.street;
    case "houseNumber":
      return contact.houseNumber;
    case "postcode":
      return matches("city", hay)
        ? `${contact.postcode} ${contact.city}`.trim()
        : contact.postcode;
    case "city":
      return contact.city;
    case "message":
      return letter;
    case "adults":
      return household.adults;
    case "children":
      return household.children;
    case "pets":
      return household.pets.some((pet) => pet.count > 0);
    case "smoker":
      return NON_SMOKER.test(hay) ? !household.smoker : household.smoker;
    case "income":
      return sumCents(profile.applicants.map((a) => a.netIncomeCents));
    case "employment":
      return applicant?.employment;
    case "moveInDate":
      return moveInDateOf(profile.moveIn);
    case "wbs":
      return profile.hasWbs;
    // No profile field holds a salutation yet; consent is never filled.
    case "salutation":
    case "consent":
    case "unknown":
      return undefined;
  }
}

export function mapFields(
  fields: readonly FormField[],
  profile: Profile,
  letter: string,
): { mappings: FieldMapping[]; matched: number; total: number } {
  const mappings = fields.filter(isFillable).map((field) => {
    const kind = classifyField(field);
    const value = valueFor(kind, field, profile, letter);
    return { field, kind, value: value === "" ? undefined : value };
  });
  return {
    mappings,
    matched: mappings.filter((m) => m.value !== undefined).length,
    total: mappings.length,
  };
}
