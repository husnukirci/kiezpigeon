// Form field matching: classify each field of a contact form from its
// plain-data description, pair it with a profile value or the letter, and
// score "X of Y matched". Consent fields and opt-in checkboxes are left
// alone and not counted (ADR 11).
import { formatDate } from "./format";
import { sumCents } from "./money";
import type {
  DocumentType,
  EmploymentType,
  FieldKind,
  FieldMapping,
  FieldOption,
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
  // `mobil` only as its own word or a known compound, not in `Immobilie`.
  [
    "phone",
    pattern({
      within: "telefon|phone|handy|mobilnummer|mobilfunk",
      whole: "tel|mobil|mobile",
    }),
  ],
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
  [
    "householdSize",
    pattern({
      within: "haushaltsgr|household ?size|number of persons|personenzahl",
    }),
  ],
  [
    "documents",
    pattern({ within: "bewerbungsunterlagen|unterlagen|documents" }),
  ],
];

/** The only checkboxes Kiezpigeon ticks: facts about the household. */
const CHECKBOX_FACTS = new Set<FieldKind>(["pets", "smoker", "wbs"]);

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
  // Fill never writes a radio (ADR 11), so it is not counted either.
  "radio",
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
  const kind = classifyByText(field);
  // Any other checkbox is an opt-in (profile sharing, newsletters, offers).
  return field.type === "checkbox" && !CHECKBOX_FACTS.has(kind)
    ? "consent"
    : kind;
}

function classifyByText(field: FormField): FieldKind {
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
  if (field.type === "select") {
    return optionFor(kind, field, profile);
  }
  const applicant = profile.applicants[0];
  const { contact, household, moveIn } = profile;
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
    case "householdSize":
      return household.adults + household.children;
    case "pets":
    case "smoker":
    case "wbs":
      return yesNoFor(kind, hay, profile);
    case "income":
      return String(Math.floor(householdIncomeCents(profile) / 100));
    case "employment":
      // A text field asks for the job itself ("Beruf").
      return applicant?.job;
    case "moveInDate":
      if (moveIn?.kind === "date") {
        return field.type === "date" ? moveIn.date : formatDate(moveIn.date);
      }
      if (field.type === "date") return undefined;
      return moveIn && MOVE_IN_TEXT[moveIn.kind];
    // No profile field holds a salutation; consent is never filled; the
    // documents question is only asked as a choice.
    case "salutation":
    case "documents":
    case "consent":
    case "unknown":
      return undefined;
  }
}

const MOVE_IN_TEXT = { asap: "ab sofort", flexible: "flexibel" } as const;

function householdIncomeCents(profile: Profile): number {
  return sumCents(profile.applicants.map((a) => a.netIncomeCents));
}

function yesNoFor(
  kind: "pets" | "smoker" | "wbs",
  hay: string,
  profile: Profile,
): boolean {
  const { household } = profile;
  switch (kind) {
    case "pets":
      return household.pets.some((pet) => pet.count > 0);
    case "smoker":
      return NON_SMOKER.test(hay) ? !household.smoker : household.smoker;
    case "wbs":
      return profile.hasWbs;
  }
}

/** An option's visible text in lower-case words, or its value if blank. */
function optionText(option: FieldOption): string {
  const text = option.label.trim() === "" ? option.value : option.label;
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function optionWhere(
  field: FormField,
  test: (text: string) => boolean,
): string | undefined {
  return field.options?.find(
    (option) => option.value !== "" && test(optionText(option)),
  )?.value;
}

const NO = new RegExp(word("nein|no|false|nicht|keine?|n|0"), "u");
const YES = new RegExp(word("ja|yes|true|vorhanden|j|y|1"), "u");

function yesNoOption(field: FormField, answer: boolean): string | undefined {
  return optionWhere(field, (text) =>
    answer ? YES.test(text) && !NO.test(text) : NO.test(text),
  );
}

const MOVE_IN_OPTIONS = {
  date: /genau|datum|date|concrete|termin/u,
  asap: /sofort|now|asap|immediately|schnellstm/u,
  flexible: /flexib/u,
} as const;

const EMPLOYMENT_OPTIONS: Record<EmploymentType, RegExp> = {
  permanent: /angestellt|arbeitnehmer|employee/u,
  fixed_term: /angestellt|arbeitnehmer|employee/u,
  civil_servant: /beamt|civil servant|officer/u,
  self_employed:
    /selbst ?st[äa]ndig|selbständig|freiberuf|self employed|freelanc/u,
  trainee: /auszubild|azubi|ausbildung|trainee|apprentic/u,
  student: /student|studier/u,
  other: /sonstig|other|andere/u,
};

const HOUSEHOLD_OPTIONS = {
  family: /famil|kinder|children/u,
  flatshare: new RegExp(word("wohngemeinschaft|wg|flatshare|shared"), "u"),
  one: /einperson|single|allein|(?:1|one|eine) person/u,
  two: /(?:zwei|2|two) (?:erwachsene|personen|adults|persons)|paar|couple/u,
} as const;

function householdOption(field: FormField, profile: Profile) {
  const { adults, children, relationship } = profile.household;
  if (children > 0)
    return optionWhere(field, (t) => HOUSEHOLD_OPTIONS.family.test(t));
  if (profile.applicants.length === 2 && relationship === "flatmates") {
    return optionWhere(field, (t) => HOUSEHOLD_OPTIONS.flatshare.test(t));
  }
  if (adults === 1)
    return optionWhere(field, (t) => HOUSEHOLD_OPTIONS.one.test(t));
  if (adults === 2)
    return optionWhere(field, (t) => HOUSEHOLD_OPTIONS.two.test(t));
  return undefined;
}

const UP_TO = new RegExp(word("unter|bis|below|under|less"), "u");
const ABOVE = new RegExp(word("über|ueber|ab|over|more|mehr"), "u");

/** Euro bounds of an income option such as `500 - 1.000 €` or `> 5.000 €`. */
function incomeRange(
  text: string,
): { above: number; upTo: number } | undefined {
  const amounts = (text.match(/\d{1,3}(?:\.\d{3})+|\d+/gu) ?? []).map(
    (amount) => Number(amount.replaceAll(".", "")),
  );
  const [first, second] = amounts;
  if (first === undefined) return undefined;
  if (second !== undefined) return { above: first, upTo: second };
  if (/</u.test(text) || UP_TO.test(text)) {
    return { above: -Infinity, upTo: first };
  }
  if (/>/u.test(text) || ABOVE.test(text)) {
    return { above: first, upTo: Infinity };
  }
  return undefined;
}

function incomeOption(field: FormField, profile: Profile): string | undefined {
  const euros = householdIncomeCents(profile) / 100;
  return field.options?.find((option) => {
    const range = incomeRange(option.label);
    return range !== undefined && euros > range.above && euros <= range.upTo;
  })?.value;
}

const DOCUMENTS: DocumentType[] = [
  "schufa",
  "mietschuldenfreiheit",
  "incomeProof",
  "id",
  "wbs",
];

/** Every document ready; the WBS only for someone who has one. */
function allDocumentsReady(profile: Profile): boolean {
  return DOCUMENTS.filter((type) => type !== "wbs" || profile.hasWbs).every(
    (type) => profile.documents[type] === "ready",
  );
}

function optionFor(
  kind: FieldKind,
  field: FormField,
  profile: Profile,
): string | undefined {
  const applicant = profile.applicants[0];
  switch (kind) {
    case "pets":
    case "smoker":
    case "wbs":
      return yesNoOption(field, yesNoFor(kind, haystack(field), profile));
    case "moveInDate": {
      const moveIn = profile.moveIn;
      return (
        moveIn &&
        optionWhere(field, (t) => MOVE_IN_OPTIONS[moveIn.kind].test(t))
      );
    }
    case "income":
      return incomeOption(field, profile);
    case "employment":
      return (
        applicant &&
        optionWhere(field, (t) =>
          EMPLOYMENT_OPTIONS[applicant.employment].test(t),
        )
      );
    case "householdSize":
      return householdOption(field, profile);
    // Saying the documents are missing would only hurt; the user decides.
    case "documents":
      return allDocumentsReady(profile) ? yesNoOption(field, true) : undefined;
    // A choice the profile cannot make (salutation, city lists, ...).
    default:
      return undefined;
  }
}

/** Whether filling `value` would change something already in the field. */
function replacesCurrent(field: FormField, value: FieldValue | undefined) {
  if (value === undefined) return false;
  // Only a tick can have been set by someone; unticked is the default.
  if (field.type === "checkbox")
    return field.checked === true && value === false;
  const current = field.value ?? "";
  return current !== "" && current !== String(value);
}

export function mapFields(
  fields: readonly FormField[],
  profile: Profile,
  letter: string,
): {
  mappings: FieldMapping[];
  matched: number;
  total: number;
  /** Consent fields and opt-ins: never filled and not counted. */
  leftAlone: FormField[];
} {
  const fillable = fields.filter(isFillable);
  const leftAlone = fillable.filter((f) => classifyField(f) === "consent");
  const mappings = fillable
    .filter((field) => !leftAlone.includes(field))
    .map((field) => {
      const kind = classifyField(field);
      const found = valueFor(kind, field, profile, letter);
      const value = found === "" ? undefined : found;
      return { field, kind, value, replaces: replacesCurrent(field, value) };
    });
  return {
    mappings,
    matched: mappings.filter((m) => m.value !== undefined).length,
    total: mappings.length,
    leftAlone,
  };
}
