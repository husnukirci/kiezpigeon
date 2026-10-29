// The letter request and the prompt built from it. Facts only: the prompt
// states what the profile and listing say, in the order a landlord weighs
// it, and nothing else. The validator (letterValidate.ts) is the guarantee;
// this prompt is the first attempt at meeting it.
import { isCloseMoveIn } from "./dates";
import { formatArea, formatDate, formatEuro, formatNumber } from "./format";
import { sumCents } from "./money";
import type {
  Availability,
  ContactPerson,
  EmploymentType,
  Feature,
  Household,
  IsoDate,
  LetterRequest,
  Listing,
  MoveIn,
  PetKind,
  PetPolicy,
  Profile,
  Relationship,
  Tone,
} from "./types";

const EMPLOYMENT_LABELS: Record<EmploymentType, string | undefined> = {
  permanent: "unbefristete Festanstellung",
  civil_servant: "verbeamtet",
  fixed_term: "befristete Anstellung",
  self_employed: "selbstständig",
  trainee: "in Ausbildung",
  student: "im Studium",
  job_seeking: "derzeit auf Stellensuche",
  other: undefined,
};

/** Singular and plural German nouns per pet kind. */
export const PET_NOUNS: Record<PetKind, readonly [string, string]> = {
  dog: ["Hund", "Hunde"],
  cat: ["Katze", "Katzen"],
  small_animal: ["Kleintier", "Kleintiere"],
  bird: ["Vogel", "Vögel"],
  other: ["Haustier", "Haustiere"],
};

const PET_POLICY_LABELS: Record<PetPolicy, string> = {
  allowed: "erlaubt",
  by_arrangement: "nach Absprache",
  not_allowed: "nicht erlaubt",
};

/** Stock phrases that make a letter read like a template. */
const CLICHES = [
  "hiermit bewerbe ich mich",
  "mit großem Interesse",
  "mit großer Freude",
  "ich würde mich riesig freuen",
  "Ihre Anzeige hat mich sofort angesprochen",
];

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  warm: "Tone: warm and personal, friendly and polite, addressing the reader as Sie.",
  formal: "Tone: formal and businesslike, addressing the reader as Sie.",
  short: "Tone: short and direct, addressing the reader as Sie.",
};

/**
 * Where each tone aims inside the length. Models land below a target more
 * often than above it, so even the short tone aims well over the minimum.
 */
const TONE_WORD_TARGETS: Record<Tone, number> = {
  warm: 150,
  formal: 150,
  short: 140,
};

const RELATIONSHIP_FACTS: Record<Relationship, string> = {
  partners: "ein Paar",
  married: "verheiratet",
  flatmates: "Wohngemeinschaft",
  family: "Familie",
};

const NO_GENDER =
  " Do not describe either applicant's gender or call one the other's girlfriend, boyfriend, wife or husband (Freundin, Freund, Partnerin, Lebensgefährtin, Ehefrau, Ehemann).";

const RELATIONSHIP_RULES: Record<Relationship, string> = {
  partners: `- Say once, briefly, that the applicants are a couple.${NO_GENDER}`,
  married: `- Say once, briefly, that the applicants are married.${NO_GENDER}`,
  flatmates:
    "- Say once, briefly, that the applicants share the flat as flatmates. Do not describe either applicant's gender.",
  family:
    "- Say once, briefly, that the applicants are family. Do not name the family relation (such as Schwester, Bruder, Sohn or Tochter) or describe either applicant's gender.",
};

/** The relationship rule for the system prompt, if the request has two applicants. */
function relationshipRule(request: LetterRequest): string[] {
  if (request.applicants.length < 2) return [];
  const { relationship } = request.household;
  return [
    relationship
      ? RELATIONSHIP_RULES[relationship]
      : "- Do not say how the applicants are related to each other.",
  ];
}

export const MIN_WORDS = 120;
export const MAX_WORDS = 180;

/**
 * A letter mentions 1 or 2 of the listing's features, or none when the
 * listing names none.
 */
export function assertFeatureCount(
  features: readonly Feature[],
  listing: Listing,
): void {
  const fewest = listing.features.length === 0 ? 0 : 1;
  if (features.length < fewest || features.length > 2) {
    throw new RangeError(
      `A letter needs ${fewest} to 2 chosen features, got ${features.length}`,
    );
  }
}

/** The move-in date, when the applicants gave one rather than a choice. */
export function moveInDateOf(moveIn: MoveIn | undefined): IsoDate | undefined {
  return moveIn?.kind === "date" ? moveIn.date : undefined;
}

/** The listing's free-from date, when it gives a date. */
export function availableDateOf(
  availability: Availability | undefined,
): IsoDate | undefined {
  return availability?.kind === "date" ? availability.date : undefined;
}

/** The contact person, or undefined when the listing gives no surname. */
export function namedContact(
  person: ContactPerson | undefined,
): ContactPerson | undefined {
  return person && person.lastName.trim() !== "" ? person : undefined;
}

/** The exact first line the letter must start with. */
export function salutationFor(contact: ContactPerson | undefined): string {
  const person = namedContact(contact);
  if (!person) return "Sehr geehrte Damen und Herren,";
  switch (person.salutation) {
    case "Frau":
      return `Sehr geehrte Frau ${person.lastName},`;
    case "Herr":
      return `Sehr geehrter Herr ${person.lastName},`;
    case undefined:
      return `Guten Tag ${[person.firstName, person.lastName].filter(Boolean).join(" ")},`;
  }
}

/** The bands ImmoScout24's contact form uses, in euros (ADR 11). */
const INCOME_BANDS = [500, 1000, 1500, 2000, 3000, 4000, 5000];

/**
 * The household income as a band, never the exact sum: "zwischen 4.000
 * und 5.000 €". A band's upper edge belongs to it, as on the form.
 */
export function incomeBand(cents: number): {
  phrase: string;
  euros: number[];
} {
  const euros = cents / 100;
  const upper = INCOME_BANDS.findIndex((edge) => euros <= edge);
  const top = INCOME_BANDS.at(-1) ?? 0;
  if (upper === -1) {
    return { phrase: `über ${formatNumber(top)} €`, euros: [top] };
  }
  const high = INCOME_BANDS[upper] ?? top;
  const low = INCOME_BANDS[upper - 1];
  if (low === undefined) {
    return { phrase: `unter ${formatNumber(high)} €`, euros: [high] };
  }
  return {
    phrase: `zwischen ${formatNumber(low)} und ${formatNumber(high)} €`,
    euros: [low, high],
  };
}

const MULTIPLES = [
  "Dreifache",
  "Vierfache",
  "Fünffache",
  "Sechsfache",
  "Siebenfache",
  "Achtfache",
  "Neunfache",
  "Zehnfache",
];

/**
 * "mehr als das Dreifache": income over Kaltmiete in words, rounded down,
 * from three times up; undefined below that or without a rent.
 */
export function incomeRatioPhrase(request: LetterRequest): string | undefined {
  const tenths = incomeRatioTenths(request);
  if (tenths === undefined || tenths < 30) return undefined;
  const whole = Math.min(Math.floor(tenths / 10), 10);
  const word = MULTIPLES[whole - 3];
  if (word === undefined) return undefined;
  return tenths === whole * 10 ? `das ${word}` : `mehr als das ${word}`;
}

/** Income divided by Kaltmiete in tenths, floored; undefined without rent. */
export function incomeRatioTenths(request: LetterRequest): number | undefined {
  const kaltmiete = request.listing.kaltmieteCents;
  if (kaltmiete === undefined || kaltmiete <= 0) return undefined;
  const income = sumCents(request.applicants.map((a) => a.netIncomeCents));
  return Math.floor((income * 10) / kaltmiete);
}

function hasPets(household: Household): boolean {
  return household.pets.some((pet) => pet.count > 0);
}

function petsPhrase(household: Household): string {
  return household.pets
    .filter((pet) => pet.count > 0)
    .map((pet) => {
      const [one, many] = PET_NOUNS[pet.kind];
      return `${pet.count} ${pet.count === 1 ? one : many}`;
    })
    .join(", ");
}

export function createLetterRequest(
  profile: Profile,
  listing: Listing,
  choice: { tone: Tone; features: Feature[] },
): LetterRequest {
  const { documents } = profile;
  const allDocumentsReady =
    documents.schufa === "ready" &&
    documents.mietschuldenfreiheit === "ready" &&
    documents.incomeProof === "ready" &&
    documents.id === "ready" &&
    (!profile.hasWbs || documents.wbs === "ready");
  const household = { ...profile.household };
  // A relationship needs two people; a leftover one is never mentioned.
  if (profile.applicants.length < 2) delete household.relationship;
  return {
    applicants: profile.applicants,
    household,
    moveIn: profile.moveIn,
    allDocumentsReady,
    contact: profile.contact,
    listing,
    tone: choice.tone,
    features: choice.features,
  };
}

function householdLine(household: Household): string {
  const adults =
    household.adults === 1
      ? "1 erwachsene Person"
      : `${household.adults} Erwachsene`;
  const children =
    household.children === 0
      ? "keine Kinder"
      : household.children === 1
        ? "1 Kind"
        : `${household.children} Kinder`;
  const smoking = household.smoker ? "Raucher" : "Nichtraucher";
  return `Haushalt: ${adults}, ${children}, ${smoking}`;
}

/** The listing's "Frei ab" in German, as the page would say it. */
function freeFrom(availability: Availability | undefined): string | undefined {
  switch (availability?.kind) {
    case undefined:
      return undefined;
    case "date":
      return formatDate(availability.date);
    case "immediately":
      return "sofort";
    case "by_arrangement":
      return "nach Vereinbarung";
  }
}

function listingLines(listing: Listing): string[] {
  const facts: [string, string | undefined][] = [
    ["Bezirk", listing.district],
    [
      "Kaltmiete",
      listing.kaltmieteCents === undefined
        ? undefined
        : formatEuro(listing.kaltmieteCents),
    ],
    [
      "Nebenkosten",
      listing.nebenkostenCents === undefined
        ? undefined
        : formatEuro(listing.nebenkostenCents),
    ],
    [
      "Warmmiete",
      listing.warmmieteCents === undefined
        ? undefined
        : formatEuro(listing.warmmieteCents),
    ],
    [
      "Größe",
      listing.areaM2 === undefined ? undefined : formatArea(listing.areaM2),
    ],
    [
      "Zimmer",
      listing.rooms === undefined ? undefined : formatNumber(listing.rooms, 1),
    ],
    ["Etage", listing.floor === undefined ? undefined : String(listing.floor)],
    ["Frei ab", freeFrom(listing.availability)],
    [
      "Baujahr",
      listing.yearBuilt === undefined ? undefined : String(listing.yearBuilt),
    ],
    [
      "Haustiere",
      listing.petPolicy === undefined
        ? undefined
        : PET_POLICY_LABELS[listing.petPolicy],
    ],
  ];
  const known = facts.flatMap(([label, value]) =>
    value === undefined ? [] : [`- ${label}: ${value}`],
  );
  return known.length === 0 ? [] : ["", "Wohnung:", ...known];
}

/** Landlord signals that hold for this request, strongest first. */
function signals(request: LetterRequest): string[] {
  const { applicants, household, listing } = request;
  const moveInDate = moveInDateOf(request.moveIn);
  const availableFrom = availableDateOf(listing.availability);
  const result: string[] = [];
  if (
    applicants.some(
      (a) => a.employment === "permanent" || a.employment === "civil_servant",
    )
  ) {
    result.push(
      "Sichere Anstellung (unbefristete Festanstellung oder verbeamtet)",
    );
  }
  const ratio = incomeRatioPhrase(request);
  if (ratio !== undefined) {
    result.push(`Einkommen ${ratio} der Kaltmiete`);
  }
  if (request.allDocumentsReady) {
    result.push("Alle Unterlagen liegen vollständig vor");
  }
  if (!household.smoker && !hasPets(household)) {
    result.push("Nichtraucherhaushalt ohne Haustiere");
  }
  if (
    moveInDate !== undefined &&
    availableFrom !== undefined &&
    isCloseMoveIn(availableFrom, moveInDate)
  ) {
    result.push(
      `Einzug zum ${formatDate(moveInDate)}, passend zum Bezugstermin`,
    );
  }
  if (request.moveIn?.kind === "asap") result.push("Einzug ab sofort möglich");
  if (request.moveIn?.kind === "flexible") {
    result.push("Beim Einzugstermin flexibel");
  }
  return result;
}

function moveInFacts(moveIn: MoveIn | undefined): string[] {
  switch (moveIn?.kind) {
    case undefined:
      return [];
    case "date":
      return [`Gewünschter Einzug: ${formatDate(moveIn.date)}`];
    case "asap":
      return ["Einzug: ab sofort möglich"];
    case "flexible":
      return ["Einzug: beim Termin flexibel"];
  }
}

function factsBlock(request: LetterRequest): string {
  const { applicants, household, listing, features } = request;
  const income = sumCents(applicants.map((a) => a.netIncomeCents));
  // No one's own income: the household's band says enough, and exact
  // sums read oddly in a letter.
  const applicantLines = applicants.map((a) =>
    [
      `- ${a.firstName} ${a.lastName}`,
      a.employment === "job_seeking" && a.job ? `zuletzt ${a.job}` : a.job,
      EMPLOYMENT_LABELS[a.employment],
    ]
      .filter((part) => part)
      .join(", "),
  );
  const ordered = signals(request);
  return [
    `Anrede: ${salutationFor(listing.contactPerson)}`,
    "",
    "Bewerber:",
    ...applicantLines,
    `Haushaltsnettoeinkommen: ${incomeBand(income).phrase} im Monat`,
    householdLine(household),
    ...(household.relationship
      ? [`Beziehung: ${RELATIONSHIP_FACTS[household.relationship]}`]
      : []),
    `Haustiere: ${hasPets(household) ? petsPhrase(household) : "keine"}`,
    ...(request.allDocumentsReady ? ["Unterlagen: alle vollständig"] : []),
    ...moveInFacts(request.moveIn),
    ...listingLines(listing),
    ...(features.length === 0
      ? []
      : ["", `Ausgewählte Merkmale: ${features.join(", ")}`]),
    ...(ordered.length === 0
      ? []
      : [
          "",
          "Stärkste Signale, in dieser Reihenfolge:",
          ...ordered.map((signal, i) => `${i + 1}. ${signal}`),
        ]),
  ].join("\n");
}

/** What the model gets: the rules as the system prompt, the facts as the user turn. */
export interface LetterPrompt {
  system: string;
  user: string;
}

/** One rule per applicant who is looking for work. */
function jobSearchRules(request: LetterRequest): string[] {
  return request.applicants
    .filter((a) => a.employment === "job_seeking")
    .map((a) => {
      const name = `${a.firstName} ${a.lastName}`;
      const last = a.job ? ` ${a.job} was the last role.` : "";
      return `- ${name} is looking for a new job;${last} Say this once, plainly and confidently. Do not suggest a current job or employer.`;
    });
}

export function buildLetterPrompt(request: LetterRequest): LetterPrompt {
  const { household, features, listing } = request;
  assertFeatureCount(features, listing);
  const system = [
    "You write a short application letter for a rental flat in Berlin on behalf of the applicants in the facts. The applicants review the letter and send it themselves.",
    "",
    "Rules:",
    "- Write in German.",
    `- ${TONE_INSTRUCTIONS[request.tone]}`,
    "- Write the way a native speaker writes to a landlord: natural, confident and friendly. Short, clear sentences. Not flowery, not stiff, no template phrases.",
    `- Avoid stock phrases such as ${CLICHES.map((c) => `"${c}"`).join(", ")}. Say the same thing plainly.`,
    "- Do not praise the applicants (zuverlässig, ruhig, ordentlich, sorgfältig) and do not claim how the flat or its location fits their life. Let the facts speak; a landlord skips such lines.",
    "- Do not offer anything the facts do not contain, such as a Bürgschaft, a guarantor or further documents, and do not comment on whether the rent is affordable.",
    `- Length: ${MIN_WORDS} to ${MAX_WORDS} words in total, salutation and sign-off included; aim for about ${TONE_WORD_TARGETS[request.tone]} words.`,
    `- Begin with exactly this line: ${salutationFor(listing.contactPerson)}`,
    "- Use only the facts given. Do not invent any detail, name, date or number; write no number that is not in the facts.",
    "- Open with the strongest signals, in the order listed.",
    "- State the household income only as the range given, never per person or as an exact sum.",
    ...jobSearchRules(request),
    ...(features.length === 0
      ? []
      : [
          `- Mention these features of the flat by name: ${features.join(", ")}.`,
        ]),
    ...(request.moveIn === undefined
      ? [
          "- The applicants gave no move-in date. Do not say when they want to move in or that the listing's date suits them.",
        ]
      : []),
    hasPets(household)
      ? `- Mention the pets honestly in one sentence: ${petsPhrase(household)}.`
      : "- The household has no pets. You may say so; never suggest any.",
    "- Never use a dash as punctuation: no em dash (U+2014) and no en dash with spaces around it. Use a comma or a full stop instead.",
    ...relationshipRule(request),
    "- Sign off with the applicants' full names.",
    "- Reply with the letter text only.",
  ].join("\n");
  return { system, user: factsBlock(request) };
}
