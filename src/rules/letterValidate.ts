// The letter validator: the guarantee that a generated letter keeps the
// letter rules (PHASES.md, Phase 1). It checks length, dashes, numbers,
// salutation, pets and chosen features; it does not grade prose.
import {
  MAX_WORDS,
  MIN_WORDS,
  PET_NOUNS,
  assertFeatureCount,
  availableDateOf,
  incomeRatioTenths,
  moveInDateOf,
  namedContact,
  salutationFor,
} from "./letterPrompt";
import { sumCents } from "./money";
import type { LetterProblem, LetterRequest, PetKind } from "./types";

/** A word is a run of non-whitespace holding at least one letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function lengthProblems(text: string): LetterProblem[] {
  const words = countWords(text);
  if (words < MIN_WORDS) return [{ code: "too_short", text: `${words} words` }];
  if (words > MAX_WORDS) return [{ code: "too_long", text: `${words} words` }];
  return [];
}

// An em dash anywhere, or an en dash with whitespace on both sides (used as
// an em dash). `18–20` between digits is a range and stays allowed.
// Escapes are spelled for RegExp so the source holds no dash characters.
const DASH = new RegExp(String.raw`\S*(?:\s*\u2014\s*|\s+\u2013\s+)\S*`, "gu");

function dashProblems(text: string): LetterProblem[] {
  return [...text.matchAll(DASH)].map((m) => ({
    code: "em_dash",
    text: m[0],
  }));
}

/** Values compared in hundredths so `3,8` and `1.180,00` match exactly. */
function key(value: number): number {
  return Math.round(value * 100);
}

/** The numeric values one written number stands for. */
function valuesOf(token: string): number[] {
  if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(token)) {
    return token.split(".").map(Number);
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token)) {
    return [Number(token.replaceAll(".", "").replace(",", "."))];
  }
  if (/^\d+(,\d+)?$/.test(token)) {
    return [Number(token.replace(",", "."))];
  }
  return token.split(/[.,]/).map(Number);
}

function dateParts(iso: string | undefined): number[] {
  return iso === undefined ? [] : iso.split("-").map(Number);
}

function digitRuns(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

function allowedNumbers(request: LetterRequest): Set<number> {
  const { applicants, household, listing, contact } = request;
  const incomes = applicants.map((a) => a.netIncomeCents);
  const rents = [
    listing.kaltmieteCents,
    listing.nebenkostenCents,
    listing.warmmieteCents,
    listing.kaltmieteCents !== undefined &&
    listing.nebenkostenCents !== undefined
      ? listing.kaltmieteCents + listing.nebenkostenCents
      : undefined,
  ];
  const petCounts = household.pets.map((p) => p.count);
  const tenths = incomeRatioTenths(request);
  const values = [
    ...[...incomes, sumCents(incomes), ...rents].flatMap((cents) =>
      cents === undefined ? [] : [cents / 100],
    ),
    listing.areaM2,
    listing.rooms,
    listing.floor,
    listing.yearBuilt,
    household.adults,
    household.children,
    household.adults + household.children,
    ...petCounts,
    sumCents(petCounts),
    ...dateParts(moveInDateOf(request.moveIn)),
    ...dateParts(availableDateOf(listing.availability)),
    tenths === undefined ? undefined : tenths / 10,
    ...[
      contact.phone,
      contact.street,
      contact.houseNumber,
      contact.postcode,
    ].flatMap(digitRuns),
  ];
  return new Set(values.flatMap((v) => (v === undefined ? [] : [key(v)])));
}

function numberProblems(text: string, request: LetterRequest): LetterProblem[] {
  const allowed = allowedNumbers(request);
  const unknown = new Set<string>();
  for (const [token] of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    if (valuesOf(token).some((v) => !allowed.has(key(v)))) unknown.add(token);
  }
  return [...unknown].map((token) => ({ code: "unknown_number", text: token }));
}

function salutationProblems(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  const firstLine = (text.trim().split(/\r?\n/)[0] ?? "").trim();
  const person = namedContact(request.listing.contactPerson);
  const ok = person
    ? firstLine.includes(person.lastName)
    : firstLine === salutationFor(undefined);
  return ok ? [] : [{ code: "wrong_salutation", text: firstLine }];
}

// Pet words match on the end of a word, so `Familienhund` counts and
// `Hunderten` does not.
const PET_WORDS: Record<PetKind, RegExp> = {
  dog: /(hund|hunde|hundes|hunden|hündin|hündinnen)$/,
  cat: /(katze|katzen|kater|katers)$/,
  small_animal:
    /(kleintier|kleintiere|kleintieren|kaninchen|meerschweinchen|hamster)$/,
  bird: /(vogel|vögel|vögeln|wellensittich|wellensittiche|wellensittichen)$/,
  other: /(haustier|haustiere|haustieren|haustiers)$/,
};
/** `Haustier` is the general word and covers every kind. */
const ANY_PET = PET_WORDS.other;
const NEGATIONS = new Set([
  "kein",
  "keine",
  "keinen",
  "keinem",
  "keiner",
  "keines",
  "ohne",
]);

/**
 * Pet words the letter uses positively. A word with `kein…` or `ohne`
 * among the two words before it is a denial, not a mention.
 */
function petMentions(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  const lower = words.map((w) => w.toLowerCase());
  return words.filter((word, i) => {
    const w = lower[i] ?? "";
    const isPet = Object.values(PET_WORDS).some((re) => re.test(w));
    const denied = lower
      .slice(Math.max(0, i - 2), i)
      .some((before) => NEGATIONS.has(before));
    return isPet && !denied;
  });
}

function petProblems(text: string, request: LetterRequest): LetterProblem[] {
  const mentioned = petMentions(text);
  const mentions = mentioned.map((w) => w.toLowerCase());
  const kinds = [
    ...new Set(
      request.household.pets.filter((p) => p.count > 0).map((p) => p.kind),
    ),
  ];
  if (kinds.length === 0) {
    return [...new Set(mentioned)].map((word) => ({
      code: "pets_invented",
      text: word,
    }));
  }
  if (mentions.some((w) => ANY_PET.test(w))) return [];
  return kinds
    .filter((kind) => !mentions.some((w) => PET_WORDS[kind].test(w)))
    .map((kind) => ({ code: "pets_missing", text: PET_NOUNS[kind][0] }));
}

// Words that say the applicants are married: Ehepaar, Eheleute, Ehemann,
// Ehefrau, Ehepartner, Ehegatte, and any form of verheiratet. `mehr` and
// `ehemalig` are not among them.
const MARRIED = /^(ehe(paar|leute|mann|männer|frau|partner|gatt)|verheirat)/;

function relationshipProblems(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  if (request.household.relationship === "married") return [];
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter((w) => MARRIED.test(w.toLowerCase()));
  return [...new Set(words)].map((word) => ({
    code: "relationship_invented",
    text: word,
  }));
}

function featureProblems(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  const lower = text.toLowerCase();
  return request.features
    .filter((feature) => !lower.includes(feature.toLowerCase()))
    .map((feature) => ({ code: "feature_missing", text: feature }));
}

export function validateLetter(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  assertFeatureCount(request.features, request.listing);
  return [
    ...lengthProblems(text),
    ...dashProblems(text),
    ...numberProblems(text, request),
    ...salutationProblems(text, request),
    ...petProblems(text, request),
    ...featureProblems(text, request),
    ...relationshipProblems(text, request),
  ];
}
