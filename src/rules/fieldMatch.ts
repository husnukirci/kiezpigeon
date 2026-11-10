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

/** Bank, identity and tax data: never filled, whatever else the text says. */
const SENSITIVE = pattern({
  within:
    "iban|kontoinhaber|kontonummer|lastschrift|kreditkarte|steuer ?id|steuer ?identifikation|steuernummer|steuer ?nr|steuerklasse|tax ?id|personalausweis|reisepass|ausweis ?nr|ausweisnummer|passport|id ?number",
  whole: "bic|sepa|konto",
});

/** A bare `Nr.`: the house number, but only as a field's own whole text. */
const BARE_NR = /^nr$/u;

/** The text that names a field: its label, or without one its attributes. */
function ownText(field: FormField): string[] {
  return field.label?.trim()
    ? [field.label]
    : [field.name, field.id, field.placeholder].filter(
        (part): part is string => part !== undefined,
      );
}

// Checked in order; the first match wins. `within` matches inside longer
// German compounds (`Haushaltsnettoeinkommen`), `whole` only as a word
// (`ort` but not `Sortierung`).
const KEYWORDS: [Exclude<FieldKind, "unknown">, RegExp][] = [
  [
    "consent",
    pattern({
      within:
        "datenschutz|privacy|consent|einverstanden|newsletter|akzeptier|zustimm|einwillig",
      whole: "agb|terms|willige|willigen",
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
      within:
        "nachname|zuname|familienname|last ?name|family ?name|surname|vollständiger name|full ?name",
    }),
  ],
  ["street", pattern({ within: "stra(?:ss|ß)e|street", whole: "str" })],
  [
    "houseNumber",
    pattern({ within: "hausnummer|hausnr|haus nr|house ?(?:number|no)" }),
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
  // Before `income`, whose words it holds.
  ["incomeType", pattern({ within: "einkommensart|income ?type" })],
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
/** Autocomplete tokens whose field takes the street and the number. */
const COMBINED_STREET_TOKENS = new Set(["street-address", "address-line1"]);
const COMBINED_NR = new RegExp(word("nr"), "u");
// "Vor- und Nachname", "Vorname, Nachname", "Name, Vorname": a label that
// asks for both names. `full name` also counts in a name or id attribute.
const FULL_NAME_LABEL =
  /(?<![\p{L}])vor(?:name)? (?:und )?(?:nach|zu)name|(?<![\p{L}])(?:nach|zu)?name (?:und )?vorname/u;
const FULL_NAME_ANYWHERE = /vollständiger name|full ?name/u;

function asksForFullName(field: FormField): boolean {
  const label = words([field.label, field.placeholder].join(" "));
  return (
    FULL_NAME_LABEL.test(label) || FULL_NAME_ANYWHERE.test(haystack(field))
  );
}
const NON_SMOKER = /nichtraucher|non ?smok/u;
const NO_PETS =
  /(?:keine?|ohne|no) (?:haus)?(?:tiere?|pets?)|(?:haustiere?|pets?) keine?/u;
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

/** Lower-case words of a text, camel case split. */
function words(text: string): string {
  return text
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The field name of an autocomplete value: its last token, since the
 * others are sections and `shipping` or `home` hints (`home tel`).
 */
function autocompleteToken(field: FormField): string {
  return field.autocomplete?.trim().toLowerCase().split(/\s+/u).at(-1) ?? "";
}

function parts(field: FormField): string[] {
  return [field.name, field.id, field.label, field.placeholder].filter(
    (part): part is string => part !== undefined,
  );
}

/** Name, id, label and placeholder as lower-case words. */
function haystack(field: FormField): string {
  return words(parts(field).join(" "));
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
  const hay = haystack(field);
  if (SENSITIVE.test(hay)) return "unknown";

  const fromAutocomplete = AUTOCOMPLETE[autocompleteToken(field)];
  // A label asking for both names beats a one-name autocomplete token, and
  // comes before the keywords, whose `vorname` would read it as a first name.
  const oneName =
    fromAutocomplete === undefined ||
    fromAutocomplete === "firstName" ||
    fromAutocomplete === "lastName";
  if (oneName && asksForFullName(field)) return "lastName";
  if (fromAutocomplete) return fromAutocomplete;
  const fromKeywords = KEYWORDS.find(([, re]) => re.test(hay));
  if (fromKeywords) return fromKeywords[0];
  if (ownText(field).some((part) => BARE_NR.test(words(part)))) {
    return "houseNumber";
  }

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
      return asksForFullName(field)
        ? [applicant?.firstName, applicant?.lastName]
            .filter(Boolean)
            .join(" ") || undefined
        : applicant?.lastName;
    case "email":
      return contact.email;
    case "phone":
      return contact.phone;
    case "street":
      return matches("houseNumber", hay) ||
        COMBINED_NR.test(words([field.label, field.placeholder].join(" "))) ||
        COMBINED_STREET_TOKENS.has(autocompleteToken(field))
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
      // A text field ("WBS-Nr.") asks for something else than yes or no.
      return field.type === "checkbox"
        ? yesNoFor(kind, hay, profile)
        : undefined;
    case "income":
      // No income given is not an income of 0.
      return householdIncomeCents(profile) === 0
        ? undefined
        : String(Math.floor(householdIncomeCents(profile) / 100));
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
    // documents and income type questions are only asked as a choice.
    case "salutation":
    case "documents":
    case "incomeType":
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
    case "pets": {
      const hasPets = household.pets.some((pet) => pet.count > 0);
      return NO_PETS.test(hay) ? !hasPets : hasPets;
    }
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

/** Placeholder options that answer nothing, whatever else they say. */
const NO_ANSWER =
  /keine angabe|bitte w[äa]hlen|please (?:choose|select)|not specified|ausw[äa]hlen/u;

function optionWhere(
  field: FormField,
  test: (text: string) => boolean,
): string | undefined {
  return field.options?.find((option) => {
    const text = optionText(option);
    return option.value !== "" && !NO_ANSWER.test(text) && test(text);
  })?.value;
}

const NO = new RegExp(word("nein|no|not|false|nicht|keine?|n|0"), "u");
const YES = new RegExp(word("ja|yes|true|vorhanden|available|j|y|1"), "u");

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
  job_seeking: /arbeitssuch|arbeitslos|stellensuch|job ?seek|unemploy/u,
  other: /sonstig|other|andere/u,
};

const HOUSEHOLD_OPTIONS = {
  family: new RegExp(`famil|kinder|children|${word("kind|child")}`, "u"),
  flatshare: new RegExp(word("wohngemeinschaft|wg|flatshare|shared"), "u"),
  one: /einperson|single|allein|(?:1|one|eine) person/u,
  two: /(?:zwei|2|two) (?:erwachsene|personen|adults|persons)|paar|couple/u,
} as const;

const CHILDLESS =
  /ohne kinder?|keine? kinder?|kinderlos|no child(?:ren)?|without children/u;

/** An option that names children: "Familie", "Paar mit Kindern". */
function withChildren(text: string): boolean {
  return HOUSEHOLD_OPTIONS.family.test(text) && !CHILDLESS.test(text);
}

function householdOption(field: FormField, profile: Profile) {
  const { adults, children, relationship } = profile.household;
  if (children > 0) return optionWhere(field, withChildren);
  // Without children, an option that names them is never the answer.
  const childless = (test: RegExp) =>
    optionWhere(field, (t) => test.test(t) && !withChildren(t));
  if (profile.applicants.length === 2 && relationship === "flatmates") {
    return childless(HOUSEHOLD_OPTIONS.flatshare);
  }
  if (adults === 1) return childless(HOUSEHOLD_OPTIONS.one);
  if (adults === 2) return childless(HOUSEHOLD_OPTIONS.two);
  return undefined;
}

const UP_TO = new RegExp(word("unter|bis|below|under|less"), "u");
const ABOVE = new RegExp(word("über|ueber|ab|over|more|mehr"), "u");

/** Euro bounds of an income option such as `500 - 1.000 €` or `> 5.000 €`. */
function incomeRange(
  text: string,
): { above: number; upTo: number } | undefined {
  const amounts = (
    text.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/gu) ?? []
  ).map((amount) => Number(amount.replace(/,\d+$/u, "").replaceAll(".", "")));
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
  if (householdIncomeCents(profile) === 0) return undefined;
  const euros = householdIncomeCents(profile) / 100;
  const optionWhereRange = (
    holds: (range: { above: number; upTo: number }) => boolean,
  ) =>
    field.options?.find((option) => {
      const range = incomeRange(option.label);
      return range !== undefined && holds(range);
    })?.value;
  // `bis 2.000` then `2.001 - 3.000` leave a gap that `2.000,50` falls in, and
  // `2.001` itself starts a band, so a miss tries whole euros with the lower
  // bound included.
  const whole = Math.floor(euros);
  return (
    optionWhereRange(({ above, upTo }) => euros > above && euros <= upTo) ??
    optionWhereRange(({ above, upTo }) => whole >= above && whole <= upTo)
  );
}

/** Jobs that mean an income of one's own, whichever way it is earned. */
const OWN_INCOME_JOBS: ReadonlySet<EmploymentType> = new Set([
  "permanent",
  "fixed_term",
  "civil_servant",
  "self_employed",
  "trainee",
]);

/**
 * The profile cannot tell Bürgergeld from Arbeitslosengeld, or a student's
 * own income from support, so anything else is left to the user.
 */
function incomeTypeOption(
  field: FormField,
  profile: Profile,
): string | undefined {
  const allOwn = profile.applicants.every((a) =>
    OWN_INCOME_JOBS.has(a.employment),
  );
  return allOwn
    ? optionWhere(field, (t) => t.includes("eigenes einkommen"))
    : undefined;
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
    case "incomeType":
      return incomeTypeOption(field, profile);
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
function replacesCurrent(
  kind: FieldKind,
  field: FormField,
  value: FieldValue | undefined,
) {
  if (value === undefined) return false;
  // Only a tick can have been set by someone; unticked is the default.
  if (field.type === "checkbox") {
    return field.checked === true && value === false;
  }
  const current = field.value ?? "";
  if (current === "") return false;
  // The same number written another way is not a replacement.
  if (kind === "phone") {
    return phoneDigits(current) !== phoneDigits(String(value));
  }
  return current !== String(value);
}

/** A German phone number as digits, `+49` and `0049` read as `0`. */
function phoneDigits(text: string): string {
  return text
    .replace(/\(0\)/gu, "")
    .replace(/[^\d+]/gu, "")
    .replace(/^(?:\+|00)49/u, "0");
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
      return {
        field,
        kind,
        value,
        replaces: replacesCurrent(kind, field, value),
      };
    });
  return {
    mappings,
    matched: mappings.filter((m) => m.value !== undefined).length,
    total: mappings.length,
    leftAlone,
  };
}
