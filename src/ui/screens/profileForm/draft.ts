// The profile while it is being edited. Money fields stay as the text the
// user typed until they parse, so "2.6" can become "2.600" without the
// field jumping; everything else is the profile itself.
import {
  centsToEuroInput,
  parseEuroInput,
  profileProblems,
} from "../../../rules/profileForm";
import type { Profile } from "../../../rules/types";

export interface Draft {
  profile: Profile;
  /** Net income text per applicant, same order as `profile.applicants`. */
  income: string[];
  budget: string;
}

export function draftFrom(profile: Profile): Draft {
  return {
    profile,
    income: profile.applicants.map((a) =>
      a.netIncomeCents === 0 ? "" : centsToEuroInput(a.netIncomeCents),
    ),
    budget:
      profile.budgetWarmCents === undefined
        ? ""
        : centsToEuroInput(profile.budgetWarmCents),
  };
}

/** Field path → the first problem for it, in form order. */
export type FieldErrors = Record<string, string>;

export function resolveDraft(draft: Draft): {
  profile: Profile;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  const applicants = draft.profile.applicants.map((applicant, i) => {
    const parsed = parseEuroInput(draft.income[i] ?? "");
    if (!parsed.ok) {
      errors[`applicants.${i}.netIncomeCents`] = parsed.problems[0] ?? "";
      return applicant;
    }
    return { ...applicant, netIncomeCents: parsed.value ?? 0 };
  });

  const { budgetWarmCents: oldBudget, ...rest } = draft.profile;
  let profile: Profile = { ...rest, applicants };
  const budget = parseEuroInput(draft.budget);
  if (!budget.ok) {
    errors.budgetWarmCents = budget.problems[0] ?? "";
    if (oldBudget !== undefined) {
      profile = { ...profile, budgetWarmCents: oldBudget };
    }
  } else if (budget.value !== undefined) {
    profile = { ...profile, budgetWarmCents: budget.value };
  }

  for (const problem of profileProblems(profile)) {
    errors[problem.field] ??= problem.message;
  }
  return { profile, errors };
}
