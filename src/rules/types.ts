// The domain in plain data (PLAN.md section 2). Money is integer cents,
// dates are ISO `YYYY-MM-DD` strings, timestamps are ISO date-time strings.

export type Cents = number;
export type IsoDate = string;
export type IsoDateTime = string;

export type EmploymentType =
  | "permanent"
  | "civil_servant"
  | "fixed_term"
  | "self_employed"
  | "trainee"
  | "student"
  | "job_seeking"
  | "other";

export interface Applicant {
  /** `a1`, `a2` */
  id: string;
  firstName: string;
  lastName: string;
  job: string;
  employment: EmploymentType;
  netIncomeCents: Cents;
}

export type PetKind = "dog" | "cat" | "small_animal" | "bird" | "other";

export interface Pet {
  kind: PetKind;
  count: number;
}

/** How two applicants are related; absent means the letter says nothing. */
export type Relationship = "partners" | "married" | "flatmates" | "family";

export interface Household {
  adults: number;
  children: number;
  pets: Pet[];
  smoker: boolean;
  /** Only meaningful with two applicants. */
  relationship?: Relationship;
}

export interface ContactDetails {
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
}

export type Tone = "warm" | "formal" | "short";
export type Language = "de" | "en";

export interface LetterDefaults {
  tone: Tone;
  language: Language;
}

export type DocumentType =
  "schufa" | "mietschuldenfreiheit" | "incomeProof" | "id" | "wbs";
export type DocumentStatus = "ready" | "pending";

/** When the applicants can move in. */
export type MoveIn =
  { kind: "date"; date: IsoDate } | { kind: "asap" } | { kind: "flexible" };

export interface Profile {
  /** One or two. */
  applicants: Applicant[];
  household: Household;
  moveIn?: MoveIn;
  contact: ContactDetails;
  /** Maximum Warmmiete. */
  budgetWarmCents?: Cents;
  hasWbs: boolean;
  letterDefaults: LetterDefaults;
  documents: Record<DocumentType, DocumentStatus>;
}

export type PetPolicy = "allowed" | "by_arrangement" | "not_allowed";

export interface ContactPerson {
  salutation?: "Frau" | "Herr";
  firstName?: string;
  lastName: string;
}

/**
 * A short German keyword as the adapter normalises it (`Balkon`, `Altbau`,
 * `Einbauküche`); the letter validator looks for it as written.
 */
export type Feature = string;

/** When the flat is free, as the listing says it. */
export type Availability =
  | { kind: "date"; date: IsoDate }
  | { kind: "immediately" }
  | { kind: "by_arrangement" };

/** What an adapter read from one listing page. */
export interface Listing {
  url: string;
  title?: string;
  address?: string;
  district?: string;
  kaltmieteCents?: Cents;
  nebenkostenCents?: Cents;
  warmmieteCents?: Cents;
  areaM2?: number;
  rooms?: number;
  floor?: number;
  availability?: Availability;
  yearBuilt?: number;
  petPolicy?: PetPolicy;
  wbsRequired?: boolean;
  contactPerson?: ContactPerson;
  features: Feature[];
  /** Keys of the fields above the page did not show, e.g. `kaltmieteCents`. */
  missing: string[];
}

/** The models a letter can be written with (ADR 4). */
export type ClaudeModel =
  | "claude-sonnet-5-5"
  | "claude-opus-5-5"
  | "claude-fable-5-1"
  | "claude-haiku-5-5";

export interface Settings {
  model: ClaudeModel;
}

export type FitRule = "budget" | "income" | "pets" | "wbs" | "moveIn";
export type FitStatus = "ok" | "warn" | "no" | "unknown";

export interface FitLine {
  rule: FitRule;
  status: FitStatus;
  reason: string;
}

/**
 * The facts a letter may use. Built from the profile and the listing; the
 * budget and the WBS flag are deliberately not part of it.
 */
export interface LetterRequest {
  applicants: Applicant[];
  household: Household;
  moveIn?: MoveIn;
  allDocumentsReady: boolean;
  contact: ContactDetails;
  listing: Listing;
  tone: Tone;
  /** One or two of the listing's features. */
  features: Feature[];
}

export type LetterProblemCode =
  | "too_short"
  | "too_long"
  | "em_dash"
  | "unknown_number"
  | "wrong_salutation"
  | "pets_missing"
  | "pets_invented"
  | "feature_missing"
  | "relationship_invented";

export interface LetterProblem {
  code: LetterProblemCode;
  /** The offending text, or what was expected and not found. */
  text: string;
}

export type FieldKind =
  | "salutation"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "street"
  | "houseNumber"
  | "postcode"
  | "city"
  | "message"
  | "adults"
  | "children"
  | "pets"
  | "smoker"
  | "income"
  | "employment"
  | "moveInDate"
  | "wbs"
  | "householdSize"
  | "documents"
  | "consent"
  | "unknown";

/** A form field as plain data; adapters build it from the DOM. */
export interface FormField {
  /** Adapter-chosen handle to find the element again when filling. */
  key: string;
  /** `text`, `email`, `checkbox`, ..., or `select` / `textarea`. */
  type: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  label?: string;
  placeholder?: string;
  visible: boolean;
  disabled: boolean;
  /** A select's choices, in page order. */
  options?: FieldOption[];
  /** What a text field or select holds now (a select's option value). */
  value?: string;
  /** Whether a checkbox is ticked now. */
  checked?: boolean;
}

export interface FieldOption {
  value: string;
  /** The visible text. */
  label: string;
}

/**
 * Ready to write into its field (ADR 11): text as the page shows it
 * (euros, German dates), a select's option value, a checkbox's tick, or a
 * count for a number field.
 */
export type FieldValue = string | number | boolean;

export interface FieldMapping {
  field: FormField;
  kind: FieldKind;
  value?: FieldValue;
  /** The field already holds something different that the value replaces. */
  replaces?: boolean;
}

export type ApplicationStatus = "sent" | "viewing" | "closed";

export interface Application {
  /** `app_<random>`, random part passed in. */
  id: string;
  listingUrl: string;
  listingTitle?: string;
  district?: string;
  warmmieteCents?: Cents;
  letter: string;
  status: ApplicationStatus;
  sentAt: IsoDateTime;
  statusChangedAt: IsoDateTime;
}
