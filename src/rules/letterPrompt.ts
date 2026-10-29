// The letter request and the prompt built from it. Facts only: the prompt
// states what the profile and listing say, in the order a landlord weighs
// it, and nothing else. The validator (letterValidate.ts) is the guarantee;
// this prompt is the first attempt at meeting it.
import { formatArea, formatDate, formatEuro, formatNumber } from "./format";
import { sumCents } from "./money";
import type {
  ContactPerson,
  EmploymentType,
  Feature,
  Household,
  LetterRequest,
  Listing,
  PetKind,
  PetPolicy,
  Profile,
  Tone,
} from "./types";

const EMPLOYMENT_LABELS: Record<EmploymentType, string | undefined> = {
  permanent: "unbefristete Festanstellung",
  civil_servant: "verbeamtet",
  fixed_term: "befristete Anstellung",
  self_employed: "selbstständig",
  trainee: "in Ausbildung",
  student: "im Studium",
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

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  warm: "Tone: warm and personal, friendly and polite, addressing the reader as Sie.",
  formal: "Tone: formal and businesslike, addressing the reader as Sie.",
  short:
    "Tone: short and direct, addressing the reader as Sie; stay near the lower end of the length.",
};

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
  return {
    applicants: profile.applicants,
    household: profile.household,
    moveInDate: profile.moveInDate,
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
    [
      "Frei ab",
      listing.availableFrom === undefined
        ? undefined
        : formatDate(listing.availableFrom),
    ],
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
  const { applicants, household, moveInDate, listing } = request;
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
  const tenths = incomeRatioTenths(request);
  if (tenths !== undefined && tenths >= 30) {
    result.push(`Einkommen ${formatNumber(tenths / 10, 1)} × Kaltmiete`);
  }
  if (request.allDocumentsReady) {
    result.push("Alle Unterlagen liegen vollständig vor");
  }
  if (!household.smoker && !hasPets(household)) {
    result.push("Nichtraucherhaushalt ohne Haustiere");
  }
  if (
    moveInDate !== undefined &&
    listing.availableFrom !== undefined &&
    moveInDate <= listing.availableFrom
  ) {
    result.push(
      `Einzug zum ${formatDate(moveInDate)}, passend zum Bezugstermin`,
    );
  }
  return result;
}

function factsBlock(request: LetterRequest): string {
  const { applicants, household, moveInDate, listing, features } = request;
  const income = sumCents(applicants.map((a) => a.netIncomeCents));
  const applicantLines = applicants.map((a) =>
    [
      `- ${a.firstName} ${a.lastName}`,
      a.job,
      EMPLOYMENT_LABELS[a.employment],
      `${formatEuro(a.netIncomeCents)} netto im Monat`,
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
    `Haushaltsnettoeinkommen: ${formatEuro(income)} im Monat`,
    householdLine(household),
    `Haustiere: ${hasPets(household) ? petsPhrase(household) : "keine"}`,
    ...(request.allDocumentsReady ? ["Unterlagen: alle vollständig"] : []),
    ...(moveInDate ? [`Gewünschter Einzug: ${formatDate(moveInDate)}`] : []),
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

export function buildLetterPrompt(request: LetterRequest): LetterPrompt {
  const { household, features, listing } = request;
  assertFeatureCount(features, listing);
  const system = [
    "You write a short application letter for a rental flat in Berlin on behalf of the applicants in the facts. The applicants review the letter and send it themselves.",
    "",
    "Rules:",
    "- Write in German.",
    `- ${TONE_INSTRUCTIONS[request.tone]}`,
    `- Length: ${MIN_WORDS} to ${MAX_WORDS} words in total, salutation and sign-off included.`,
    `- Begin with exactly this line: ${salutationFor(listing.contactPerson)}`,
    "- Use only the facts given. Do not invent any detail, name, date or number; write no number that is not in the facts.",
    "- Open with the strongest signals, in the order listed.",
    ...(features.length === 0
      ? []
      : [
          `- Mention these features of the flat by name: ${features.join(", ")}.`,
        ]),
    hasPets(household)
      ? `- Mention the pets honestly in one sentence: ${petsPhrase(household)}.`
      : "- The household has no pets. You may say so; never suggest any.",
    "- Never use a dash as punctuation: no em dash (U+2014) and no en dash with spaces around it. Use a comma or a full stop instead.",
    "- Sign off with the applicants' full names.",
    "- Reply with the letter text only.",
  ].join("\n");
  return { system, user: factsBlock(request) };
}
