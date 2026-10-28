// What the profile form needs beyond `parseProfile`: reading a German euro
// amount the user typed, writing one back for editing, and the problems a
// user can fix, keyed by field path so each shows under its own input.
import { formatEuro } from "./format";
import type { Parsed } from "./profile";
import type { Cents, Profile } from "./types";

export interface FieldProblem {
  /** Dotted path into the profile: `applicants.0.firstName`. */
  field: string;
  message: string;
}

// Whole euros, either plain (`2600`) or grouped in threes (`2.600`), then
// up to two decimals after a comma.
const EURO_INPUT = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/** `2.600,50` → 260050 cents. Blank is no amount; anything else is a problem. */
export function parseEuroInput(text: string): Parsed<Cents | undefined> {
  const bare = text.trim().replace(/^€\s*/, "").replace(/\s*€$/, "");
  if (bare === "") return { ok: true, value: undefined };
  const match = EURO_INPUT.exec(bare);
  if (!match) {
    return { ok: false, problems: ["Write the amount like 2.600 or 2.600,50"] };
  }
  const euros = Number((match[1] ?? "").replaceAll(".", ""));
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return { ok: true, value: euros * 100 + cents };
}

/** 260050 → `2.600,50`: the amount as the user would type it. */
export function centsToEuroInput(cents: Cents): string {
  return formatEuro(cents).replace(/ €$/, "");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The problems a user must fix before the profile is saved, in form order. */
export function profileProblems(profile: Profile): FieldProblem[] {
  const problems: FieldProblem[] = [];
  profile.applicants.forEach((applicant, i) => {
    if (applicant.firstName.trim() === "") {
      problems.push({
        field: `applicants.${i}.firstName`,
        message: "Add a first name",
      });
    }
    if (applicant.lastName.trim() === "") {
      problems.push({
        field: `applicants.${i}.lastName`,
        message: "Add a last name",
      });
    }
    if (applicant.netIncomeCents === 0) {
      problems.push({
        field: `applicants.${i}.netIncomeCents`,
        message: "Landlords filter on income. Add it for a stronger letter.",
      });
    }
  });
  if (profile.household.adults < profile.applicants.length) {
    problems.push({
      field: "household.adults",
      message: "Count every applicant as an adult",
    });
  }
  const email = profile.contact.email.trim();
  if (email === "") {
    problems.push({
      field: "contact.email",
      message: "Add an email so landlords can reply",
    });
  } else if (!EMAIL.test(email)) {
    problems.push({
      field: "contact.email",
      message: "That email looks incomplete",
    });
  }
  return problems;
}
