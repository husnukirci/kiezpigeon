// A listing on a site without an adapter (Phase 6): the user types the
// facts in the panel, and only those become the `Listing`. Nothing is read
// from the page or guessed; every fact the user left blank is `missing`.
import { parseEuroInput, type FieldProblem } from "./profileForm";
import type { ContactPerson, Feature, Listing } from "./types";

/** The panel's inputs, as typed. */
export interface ListingFacts {
  title: string;
  kaltmiete: string;
  warmmiete: string;
  salutation: "" | "Frau" | "Herr";
  contactLastName: string;
  /** Comma-separated: `Balkon, Altbau`. */
  features: string;
}

export const EMPTY_FACTS: ListingFacts = {
  title: "",
  kaltmiete: "",
  warmmiete: "",
  salutation: "",
  contactLastName: "",
  features: "",
};

export type FactProblem = FieldProblem & { field: keyof ListingFacts };

/** The `Listing` fields that can be missing, in the adapter's order. */
const FACT_FIELDS = [
  "title",
  "address",
  "district",
  "kaltmieteCents",
  "nebenkostenCents",
  "warmmieteCents",
  "areaM2",
  "rooms",
  "floor",
  "availability",
  "yearBuilt",
  "petPolicy",
  "wbsRequired",
  "contactPerson",
] as const;

/** `Balkon, Altbau;Aufzug` → three features; blanks and repeats dropped. */
export function featuresFromText(text: string): Feature[] {
  const features: Feature[] = [];
  for (const part of text.split(/[,;\n]/)) {
    const feature = part.trim();
    const seen = features.some(
      (f) => f.toLowerCase() === feature.toLowerCase(),
    );
    if (feature !== "" && !seen) features.push(feature);
  }
  return features;
}

export function listingFromFacts(
  facts: ListingFacts,
  url: string,
): { ok: true; value: Listing } | { ok: false; problems: FactProblem[] } {
  const problems: FactProblem[] = [];
  const kalt = parseEuroInput(facts.kaltmiete);
  if (!kalt.ok) problems.push(...asProblems("kaltmiete", kalt.problems));
  const warm = parseEuroInput(facts.warmmiete);
  if (!warm.ok) problems.push(...asProblems("warmmiete", warm.problems));
  if (
    kalt.ok &&
    warm.ok &&
    kalt.value !== undefined &&
    warm.value !== undefined &&
    warm.value < kalt.value
  ) {
    problems.push({
      field: "warmmiete",
      message: "The Warmmiete includes the Kaltmiete, so it cannot be lower",
    });
  }
  const lastName = facts.contactLastName.trim();
  if (facts.salutation !== "" && lastName === "") {
    problems.push({
      field: "contactLastName",
      message:
        "Add the contact person's last name, or set the salutation to none",
    });
  }
  if (!kalt.ok || !warm.ok || problems.length > 0) {
    return { ok: false, problems };
  }

  const contactPerson: ContactPerson | undefined =
    lastName === ""
      ? undefined
      : facts.salutation === ""
        ? { lastName }
        : { salutation: facts.salutation, lastName };
  const typed: Partial<Listing> = {
    title: facts.title.trim() || undefined,
    kaltmieteCents: kalt.value,
    warmmieteCents: warm.value,
    contactPerson,
  };

  const listing: Listing = {
    url,
    features: featuresFromText(facts.features),
    missing: [],
  };
  for (const field of FACT_FIELDS) {
    const value = typed[field];
    if (value === undefined) listing.missing.push(field);
    else Object.assign(listing, { [field]: value });
  }
  return { ok: true, value: listing };
}

function asProblems(
  field: keyof ListingFacts,
  messages: string[],
): FactProblem[] {
  return messages.map((message) => ({ field, message }));
}
