// The letter validator: the guarantee that a generated letter keeps the
// letter rules (PHASES.md, Phase 1). It checks length, dashes, numbers,
// salutation, pets and chosen features; it does not grade prose.
import {
  MAX_WORDS,
  PET_NOUNS,
  assertFeatureCount,
  availableDateOf,
  incomePhrase,
  incomeRatioTenths,
  moveInDateOf,
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
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token)) {
    return [Number(token.replaceAll(".", "").replace(",", "."))];
  }
  if (/^\d+(,\d+)?$/.test(token)) {
    return [Number(token.replace(",", "."))];
  }
  return token.split(/[.,]/).map(Number);
}

// `d.m`, `d.m.yy` and `d.m.yyyy` (a trailing point is not part of a token).
const DATE_TOKEN = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/;

/** The year, month and day of an ISO date as plain numbers. */
function dateParts(iso: string | undefined): number[] {
  return iso === undefined ? [] : iso.split("-").map(Number);
}

/** Whether a written date names the ISO date: day and month equal, and the
 * year too when it is written (two digits compare with its last two). */
function sameDate(token: string, iso: string | undefined): boolean {
  const match = DATE_TOKEN.exec(token);
  if (match === null || iso === undefined) return false;
  const [year, month, day] = dateParts(iso);
  const [, d, m, y] = match;
  if (Number(d) !== day || Number(m) !== month) return false;
  if (y === undefined) return true;
  return y.length === 2 ? Number(y) === (year ?? 0) % 100 : Number(y) === year;
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
    ...incomePhrase(sumCents(incomes)).euros,
    ...[
      contact.phone,
      contact.street,
      contact.houseNumber,
      contact.postcode,
    ].flatMap(digitRuns),
  ];
  return new Set(values.flatMap((v) => (v === undefined ? [] : [key(v)])));
}

/** A date-shaped token is a date: it must be the move-in or the free-from
 * date, unless it reads as an allowed point decimal ("2.5 Zimmer"). */
function numberIsKnown(
  token: string,
  allowed: Set<number>,
  request: LetterRequest,
): boolean {
  if (!DATE_TOKEN.test(token)) {
    return valuesOf(token).every((v) => allowed.has(key(v)));
  }
  return (
    sameDate(token, moveInDateOf(request.moveIn)) ||
    sameDate(token, availableDateOf(request.listing.availability)) ||
    allowed.has(key(Number(token)))
  );
}

function numberProblems(text: string, request: LetterRequest): LetterProblem[] {
  const allowed = allowedNumbers(request);
  const unknown = new Set<string>();
  for (const [token] of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    if (!numberIsKnown(token, allowed, request)) unknown.add(token);
  }
  return [...unknown].map((token) => ({ code: "unknown_number", text: token }));
}

function salutationProblems(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  const firstLine = (text.trim().split(/\r?\n/)[0] ?? "").trim();
  const ok = firstLine === salutationFor(request.listing.contactPerson);
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
  "keinerlei",
  "ohne",
  "weder",
]);
/** Words that join pets or other nouns into one denied list. */
const JOINERS = new Set(["und", "oder", "noch", "sowie"]);
/** Verbs that make a clause-final `nicht` a denial of the pet before it. */
const HAVE_VERBS = new Set([
  "haben",
  "habe",
  "besitzen",
  "besitze",
  "halten",
  "halte",
  "gibt",
]);

/**
 * Pet words the letter uses positively. A word with `kein…`, `ohne` or
 * `weder` among the two words before it is a denial, not a mention, once
 * a list of `und`/`oder`/`noch`/`sowie` words is stepped over ("keine
 * Kinder oder Haustiere", "weder Hund noch Katze"). So is a `kein…` up to
 * three words after it that ends the clause ("Haustiere haben wir
 * keine."), and a clause-final `nicht` after a have-verb ("Haustiere
 * haben wir nicht."), but not a `kein…` that goes on ("Hund hat keine
 * Probleme").
 */
function petMentions(text: string): string[] {
  const raw = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const words = raw.map((w) => w.replace(/[^\p{L}]/gu, ""));
  const lower = words.map((w) => w.toLowerCase());
  const endsClause = (i: number): boolean =>
    i === raw.length - 1 || /[.,;:!?]$/u.test(raw[i] ?? "");
  const deniedAfter = (i: number): boolean => {
    for (let j = i + 1; j <= i + 3 && j < raw.length; j += 1) {
      if (NEGATIONS.has(lower[j] ?? "")) return endsClause(j);
      if (lower[j] === "nicht") {
        return (
          endsClause(j) &&
          lower.slice(i + 1, j).some((between) => HAVE_VERBS.has(between))
        );
      }
      if (endsClause(j)) return false;
    }
    return false;
  };
  return words.filter((_, i) => {
    const w = lower[i] ?? "";
    const isPet = Object.values(PET_WORDS).some((re) => re.test(w));
    let start = i;
    while (start >= 2 && JOINERS.has(lower[start - 1] ?? "")) start -= 2;
    const deniedBefore = lower
      .slice(Math.max(0, start - 2), start)
      .some((before) => NEGATIONS.has(before));
    return isPet && !deniedBefore && !(!endsClause(i) && deniedAfter(i));
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
  const invented: LetterProblem[] = [...new Set(mentioned)]
    .filter(
      (word) =>
        !ANY_PET.test(word.toLowerCase()) &&
        !kinds.some((kind) => PET_WORDS[kind].test(word.toLowerCase())),
    )
    .map((word) => ({ code: "pets_invented", text: word }));
  if (mentions.some((w) => ANY_PET.test(w))) return invented;
  const missing: LetterProblem[] = kinds
    .filter((kind) => !mentions.some((w) => PET_WORDS[kind].test(w)))
    .map((kind) => ({ code: "pets_missing", text: PET_NOUNS[kind][0] }));
  return [...invented, ...missing];
}

// Words that say the applicants are married. Compounds match anywhere in
// the word (Akademikerehepaar, Lehrer-Ehepaar once hyphens are stripped);
// the rest only as a whole word or its start, so mehr, eher, ehemalig,
// ehrlich, eheähnlich and unverheiratet stay clean. The bare noun `Ehe`
// counts only after an article or possessive: "Ehe wir umziehen" is the
// conjunction. Directly after `nicht` nothing is a claim.
const MARRIED =
  /ehe(paar|leute|mann|männer|frau|partner|gatt)|^verheirat|^geheirat|^hochzeit|^gatt(e|in)/;

const EHE_DETERMINERS = new Set([
  "die",
  "der",
  "unsere",
  "unserer",
  "meine",
  "meiner",
  "eine",
  "einer",
]);

function relationshipProblems(
  text: string,
  request: LetterRequest,
): LetterProblem[] {
  if (request.household.relationship === "married") return [];
  const words = text.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, ""));
  const claimed = words.filter((word, i) => {
    const lower = word.toLowerCase();
    const before = (words[i - 1] ?? "").toLowerCase();
    const isClaim =
      MARRIED.test(lower) || (lower === "ehe" && EHE_DETERMINERS.has(before));
    return isClaim && before !== "nicht";
  });
  return [...new Set(claimed)].map((word) => ({
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
