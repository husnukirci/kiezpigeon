// Profile and application validation, defaults, and the export file.
// Hand-written readers (ADR 3: no schema library) that take `unknown`,
// name every problem by its path, and build a clean value with only the
// keys they know, so nothing unexpected reaches storage or an export.
import { isCents } from "./money";
import type {
  Application,
  ApplicationStatus,
  Applicant,
  ClaudeModel,
  ContactDetails,
  DocumentStatus,
  DocumentType,
  EmploymentType,
  Household,
  IsoDateTime,
  Language,
  MoveIn,
  Pet,
  PetKind,
  Profile,
  Relationship,
  Settings,
  Tone,
} from "./types";

export type Parsed<T> =
  { ok: true; value: T } | { ok: false; problems: string[] };

export const EXPORT_VERSION = 2;

/** Export versions importData still reads; 1 had a bare `moveInDate`. */
const IMPORTABLE_VERSIONS: readonly unknown[] = [1, EXPORT_VERSION];

export interface ExportFile {
  kiezpigeon: typeof EXPORT_VERSION;
  exportedAt: IsoDateTime;
  profile: Profile;
  applications: Application[];
}

const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "permanent",
  "civil_servant",
  "job_seeking",
  "fixed_term",
  "self_employed",
  "trainee",
  "student",
  "other",
];
const PET_KINDS: readonly PetKind[] = [
  "dog",
  "cat",
  "small_animal",
  "bird",
  "other",
];
const TONES: readonly Tone[] = ["warm", "formal", "short"];
const LANGUAGES: readonly Language[] = ["de", "en"];
const DOCUMENT_TYPES: readonly DocumentType[] = [
  "schufa",
  "mietschuldenfreiheit",
  "incomeProof",
  "id",
  "wbs",
];
const DOCUMENT_STATUSES: readonly DocumentStatus[] = ["ready", "pending"];
/** Sonnet first: the default. Then stronger, then cheaper. */
export const CLAUDE_MODELS: readonly ClaudeModel[] = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-fable-5-1",
  "claude-haiku-5-5",
];
const RELATIONSHIPS: readonly Relationship[] = [
  "partners",
  "married",
  "flatmates",
  "family",
];
const MOVE_IN_KINDS: readonly MoveIn["kind"][] = ["date", "asap", "flexible"];
const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "sent",
  "viewing",
  "closed",
];

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const days = daysInMonth[month - 1];
  return days !== undefined && day >= 1 && day <= days;
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    isIsoDate(value.slice(0, 10)) &&
    value[10] === "T" &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * Reads fields off an unknown object, recording a problem per bad field.
 * Each reader returns a placeholder on failure; the caller only uses the
 * built value when there were no problems.
 */
/** Parses as a URL (the tracker reads its host) and is http or https. */
function isWebUrl(value: string): boolean {
  if (!/^https?:\/\/[^/?#\s]+/i.test(value)) return false;
  try {
    return new URL(value).hostname !== "";
  } catch {
    return false;
  }
}

class Reader {
  constructor(
    private readonly problems: string[],
    private readonly path: string,
    private readonly source: Record<string, unknown>,
  ) {}

  static of(
    problems: string[],
    path: string,
    value: unknown,
    name: string,
  ): Reader | undefined {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return new Reader(problems, path, value as Record<string, unknown>);
    }
    problems.push(`${name}: must be an object`);
    return undefined;
  }

  pathOf(key: string): string {
    return this.path ? `${this.path}.${key}` : key;
  }

  fail(key: string, message: string): void {
    this.problems.push(`${this.pathOf(key)}: ${message}`);
  }

  raw(key: string): unknown {
    return this.source[key];
  }

  text(key: string): string {
    const value = this.source[key];
    if (typeof value === "string") return value;
    this.fail(key, "must be text");
    return "";
  }

  /** An http(s) address with a host: the tracker opens it as a link. */
  webUrl(key: string): string {
    const value = this.source[key];
    if (typeof value === "string" && isWebUrl(value)) return value;
    this.fail(key, "must be a web address (http or https)");
    return "";
  }

  optionalText(key: string): string | undefined {
    return this.source[key] === undefined ? undefined : this.text(key);
  }

  bool(key: string): boolean {
    const value = this.source[key];
    if (typeof value === "boolean") return value;
    this.fail(key, "must be true or false");
    return false;
  }

  oneOf<T extends string>(key: string, allowed: readonly T[]): T {
    const value = this.source[key];
    if (allowed.includes(value as T)) return value as T;
    this.fail(key, `must be one of ${allowed.join(", ")}`);
    return allowed[0] as T;
  }

  cents(key: string): number {
    const value = this.source[key];
    if (isCents(value)) return value;
    this.fail(key, "must be whole cents, 0 or more");
    return 0;
  }

  optionalCents(key: string): number | undefined {
    return this.source[key] === undefined ? undefined : this.cents(key);
  }

  count(key: string, min: number): number {
    const value = this.source[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= min) {
      return value;
    }
    this.fail(key, `must be a whole number, ${min} or more`);
    return min;
  }

  optionalDate(key: string): string | undefined {
    const value = this.source[key];
    if (value === undefined) return undefined;
    if (isIsoDate(value)) return value;
    this.fail(key, "must be a date as YYYY-MM-DD");
    return undefined;
  }

  date(key: string): string {
    if (this.raw(key) === undefined) {
      this.fail(key, "must be a date as YYYY-MM-DD");
      return "";
    }
    return this.optionalDate(key) ?? "";
  }

  dateTime(key: string): string {
    const value = this.source[key];
    if (isIsoDateTime(value)) return value;
    this.fail(key, "must be a date and time");
    return "";
  }

  object(key: string): Reader | undefined {
    return Reader.of(
      this.problems,
      this.pathOf(key),
      this.source[key],
      this.pathOf(key),
    );
  }

  array(key: string): unknown[] {
    const value = this.source[key];
    if (Array.isArray(value)) return value;
    this.fail(key, "must be a list");
    return [];
  }

  item(key: string, index: number, value: unknown): Reader | undefined {
    const path = `${this.pathOf(key)}[${index}]`;
    return Reader.of(this.problems, path, value, path);
  }
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

function readApplicant(r: Reader): Applicant {
  return {
    id: r.text("id"),
    firstName: r.text("firstName"),
    lastName: r.text("lastName"),
    job: r.text("job"),
    employment: r.oneOf("employment", EMPLOYMENT_TYPES),
    netIncomeCents: r.cents("netIncomeCents"),
  };
}

function readPet(r: Reader): Pet {
  return { kind: r.oneOf("kind", PET_KINDS), count: r.count("count", 0) };
}

function readHousehold(r: Reader): Household {
  return withoutUndefined({
    adults: r.count("adults", 1),
    children: r.count("children", 0),
    pets: r
      .array("pets")
      .map((pet, i) => r.item("pets", i, pet))
      .flatMap((pr) => (pr ? [readPet(pr)] : [])),
    smoker: r.bool("smoker"),
    relationship:
      r.raw("relationship") === undefined
        ? undefined
        : r.oneOf("relationship", RELATIONSHIPS),
  });
}

function readContact(r: Reader): ContactDetails {
  return {
    email: r.text("email"),
    phone: r.text("phone"),
    street: r.text("street"),
    houseNumber: r.text("houseNumber"),
    postcode: r.text("postcode"),
    city: r.text("city"),
  };
}

// Fields are read in profile order so problems are listed in that order.
function readProfile(r: Reader): Profile {
  const applicantItems = r.array("applicants");
  if (
    Array.isArray(r.raw("applicants")) &&
    ![1, 2].includes(applicantItems.length)
  ) {
    r.fail("applicants", "must have 1 or 2 entries");
  }
  const applicants = applicantItems
    .map((a, i) => r.item("applicants", i, a))
    .flatMap((ar) => (ar ? [readApplicant(ar)] : []));
  const householdReader = r.object("household");
  const household = householdReader
    ? readHousehold(householdReader)
    : defaultHousehold();
  // How two people are related means nothing for one: an import or a hand
  // edit must not keep one that a later co-applicant would inherit.
  if (applicants.length < 2) delete household.relationship;
  const moveInReader =
    r.raw("moveIn") === undefined ? undefined : r.object("moveIn");
  const moveIn = moveInReader && readMoveIn(moveInReader);
  const contactReader = r.object("contact");
  const contact = contactReader ? readContact(contactReader) : emptyContact();
  const budgetWarmCents = r.optionalCents("budgetWarmCents");
  const hasWbs = r.bool("hasWbs");
  const defaults = r.object("letterDefaults");
  const letterDefaults = {
    tone: defaults ? defaults.oneOf("tone", TONES) : "warm",
    language: defaults ? defaults.oneOf("language", LANGUAGES) : "de",
  } as const;
  const docs = r.object("documents");
  const documents = Object.fromEntries(
    DOCUMENT_TYPES.map((type) => [
      type,
      docs ? docs.oneOf(type, DOCUMENT_STATUSES) : "pending",
    ]),
  ) as Record<DocumentType, DocumentStatus>;
  return withoutUndefined({
    applicants,
    household,
    moveIn,
    contact,
    budgetWarmCents,
    hasWbs,
    letterDefaults,
    documents,
  });
}

function readMoveIn(r: Reader): MoveIn {
  const kind = r.oneOf("kind", MOVE_IN_KINDS);
  if (kind !== "date") return { kind };
  // An unknown kind falls back to "date" and is already a problem; only a
  // real date move-in is asked for its date.
  return { kind, date: r.raw("kind") === "date" ? r.date("date") : "" };
}

function readApplication(r: Reader): Application {
  return withoutUndefined({
    id: r.text("id"),
    listingUrl: r.webUrl("listingUrl"),
    listingTitle: r.optionalText("listingTitle"),
    district: r.optionalText("district"),
    warmmieteCents: r.optionalCents("warmmieteCents"),
    letter: r.text("letter"),
    status: r.oneOf("status", APPLICATION_STATUSES),
    sentAt: r.dateTime("sentAt"),
    statusChangedAt: r.dateTime("statusChangedAt"),
  });
}

function parseWith<T>(
  input: unknown,
  name: string,
  read: (r: Reader) => T,
): Parsed<T> {
  const problems: string[] = [];
  const reader = Reader.of(problems, "", input, name);
  const value = reader ? read(reader) : undefined;
  return problems.length === 0 && value !== undefined
    ? { ok: true, value }
    : { ok: false, problems };
}

export function parseProfile(input: unknown): Parsed<Profile> {
  return parseWith(input, "profile", readProfile);
}

export function parseApplication(input: unknown): Parsed<Application> {
  return parseWith(input, "application", readApplication);
}

export function parseSettings(input: unknown): Parsed<Settings> {
  return parseWith(input, "settings", (r) => ({
    model: r.oneOf("model", CLAUDE_MODELS),
  }));
}

export function defaultSettings(): Settings {
  return { model: "claude-sonnet-5-5" };
}

/**
 * The user's own API key, trimmed. Problems never repeat the value, so a
 * mistyped key cannot end up in a message or a log.
 */
export function parseApiKey(input: unknown): Parsed<string> {
  const key = typeof input === "string" ? input.trim() : "";
  if (key === "") return { ok: false, problems: ["apiKey: is empty"] };
  if (/\s/.test(key)) {
    return { ok: false, problems: ["apiKey: must not contain spaces"] };
  }
  return { ok: true, value: key };
}

/**
 * Schema 1 stored the move-in as a bare `moveInDate`; schema 2 stores a
 * `moveIn` choice (ADR 10). Anything else passes through unchanged for the
 * reader to judge.
 */
export function upgradeProfileV1(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return raw;
  }
  const { moveInDate, ...rest } = raw as Record<string, unknown>;
  if (moveInDate === undefined) return raw;
  return { ...rest, moveIn: { kind: "date", date: moveInDate } };
}

function defaultHousehold(): Household {
  return { adults: 1, children: 0, pets: [], smoker: false };
}

function emptyContact(): ContactDetails {
  return {
    email: "",
    phone: "",
    street: "",
    houseNumber: "",
    postcode: "",
    city: "",
  };
}

/** The starting point for onboarding: one applicant, warm German letters. */
export function defaultProfile(): Profile {
  return {
    applicants: [
      {
        id: "a1",
        firstName: "",
        lastName: "",
        job: "",
        employment: "other",
        netIncomeCents: 0,
      },
    ],
    household: defaultHousehold(),
    contact: emptyContact(),
    hasWbs: false,
    letterDefaults: { tone: "warm", language: "de" },
    documents: {
      schufa: "pending",
      mietschuldenfreiheit: "pending",
      incomeProof: "pending",
      id: "pending",
      wbs: "pending",
    },
  };
}

function cleaned<T>(parsed: Parsed<T>, what: string): T {
  if (!parsed.ok) {
    throw new Error(
      `Cannot export an invalid ${what}: ${parsed.problems.join("; ")}`,
    );
  }
  return parsed.value;
}

/**
 * The export file. Profile and applications are rebuilt from known keys,
 * so an API key (or anything else) on the objects passed in never leaves.
 */
export function exportData(
  profile: Profile,
  applications: readonly Application[],
  exportedAt: IsoDateTime,
): ExportFile {
  return {
    kiezpigeon: EXPORT_VERSION,
    exportedAt,
    profile: cleaned(parseProfile(profile), "profile"),
    applications: applications.map((a) =>
      cleaned(parseApplication(a), "application"),
    ),
  };
}

/** Reads an export file's text. All or nothing: any problem imports none. */
export function importData(
  json: string,
): Parsed<{ profile: Profile; applications: Application[] }> {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { ok: false, problems: ["file: is not valid JSON"] };
  }
  const problems: string[] = [];
  const file = Reader.of(problems, "", input, "file");
  if (!file) return { ok: false, problems };

  const version = file.raw("kiezpigeon");
  if (version === undefined) {
    return { ok: false, problems: ["kiezpigeon: not a Kiezpigeon export"] };
  }
  if (!IMPORTABLE_VERSIONS.includes(version)) {
    return {
      ok: false,
      problems: [`kiezpigeon: unknown file version ${JSON.stringify(version)}`],
    };
  }

  file.dateTime("exportedAt");
  const rawProfile = file.raw("profile");
  const profileReader = Reader.of(
    problems,
    "profile",
    version === 1 ? upgradeProfileV1(rawProfile) : rawProfile,
    "profile",
  );
  const profile = profileReader ? readProfile(profileReader) : undefined;
  const applications = file
    .array("applications")
    .map((a, i) => file.item("applications", i, a))
    .flatMap((ar) => (ar ? [readApplication(ar)] : []));

  return problems.length === 0 && profile
    ? { ok: true, value: { profile, applications } }
    : { ok: false, problems };
}
