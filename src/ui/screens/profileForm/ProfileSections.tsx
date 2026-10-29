// The profile's fields as cards, shared by onboarding (one group per step)
// and settings (all groups on one screen). Each section edits the draft and
// shows the errors it is given; deciding when to show them is the screen's.
import type {
  Applicant,
  DocumentType,
  EmploymentType,
  Language,
  PetKind,
  Profile,
  Tone,
} from "../../../rules/types";
import { moveInDateOf } from "../../../rules/letterPrompt";
import { cx } from "../../cx";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { ChipRow, DocumentChip, ToggleChip } from "../../components/Chip/Chip";
import { ExclamationIcon, PlusIcon } from "../../components/Icons/Icons";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { Stepper } from "../../components/Stepper/Stepper";
import { SelectField, TextField } from "../../components/TextField/TextField";
import type { Draft, FieldErrors } from "./draft";
import styles from "./ProfileSections.module.css";

export interface SectionProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: FieldErrors;
}

const EMPLOYMENT: readonly { value: EmploymentType; label: string }[] = [
  { value: "permanent", label: "Permanent (unbefristet)" },
  { value: "civil_servant", label: "Civil servant (Beamte)" },
  { value: "fixed_term", label: "Fixed term (befristet)" },
  { value: "self_employed", label: "Self-employed" },
  { value: "trainee", label: "Trainee (Azubi)" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

const PET_KINDS: readonly { value: PetKind; label: string }[] = [
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "small_animal", label: "Small animal" },
  { value: "bird", label: "Bird" },
  { value: "other", label: "Other" },
];

const DOCUMENTS: readonly { type: DocumentType; label: string }[] = [
  { type: "schufa", label: "SCHUFA" },
  { type: "mietschuldenfreiheit", label: "Mietschuldenfreiheit" },
  { type: "incomeProof", label: "Income proofs" },
  { type: "id", label: "ID" },
  { type: "wbs", label: "WBS" },
];

export const TONES: readonly { value: Tone; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "formal", label: "Formal" },
  { value: "short", label: "Short" },
];

const LANGUAGES: readonly { value: Language; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

const MAX_ADULTS = 10;
const MAX_CHILDREN = 10;
const MAX_PETS = 10;

function withProfile(draft: Draft, profile: Partial<Profile>): Draft {
  return { ...draft, profile: { ...draft.profile, ...profile } };
}

export function ApplicantsSection({ draft, onChange, errors }: SectionProps) {
  const { applicants, household } = draft.profile;

  const setApplicant = (index: number, change: Partial<Applicant>): void => {
    onChange(
      withProfile(draft, {
        applicants: applicants.map((a, i) =>
          i === index ? { ...a, ...change } : a,
        ),
      }),
    );
  };

  const setIncome = (index: number, text: string): void => {
    onChange({
      ...draft,
      income: draft.income.map((t, i) => (i === index ? text : t)),
    });
  };

  const addCoApplicant = (): void => {
    onChange({
      ...withProfile(draft, {
        applicants: [
          ...applicants,
          {
            id: "a2",
            firstName: "",
            lastName: "",
            job: "",
            employment: "other",
            netIncomeCents: 0,
          },
        ],
        household: { ...household, adults: Math.max(household.adults, 2) },
      }),
      income: [...draft.income, ""],
    });
  };

  const removeCoApplicant = (): void => {
    onChange({
      ...withProfile(draft, { applicants: applicants.slice(0, 1) }),
      income: draft.income.slice(0, 1),
    });
  };

  return (
    <>
      {applicants.map((applicant, i) => {
        const field = (key: string): string | undefined =>
          errors[`applicants.${i}.${key}`];
        return (
          <Card key={applicant.id} title={i === 0 ? "You" : "Co-applicant"}>
            <div className={styles.pair}>
              <TextField
                label="First name"
                autoComplete={i === 0 ? "given-name" : "off"}
                value={applicant.firstName}
                error={field("firstName")}
                onChange={(firstName) => {
                  setApplicant(i, { firstName });
                }}
              />
              <TextField
                label="Last name"
                autoComplete={i === 0 ? "family-name" : "off"}
                value={applicant.lastName}
                error={field("lastName")}
                onChange={(lastName) => {
                  setApplicant(i, { lastName });
                }}
              />
            </div>
            <TextField
              label="Job"
              placeholder="e.g. Pflegefachkraft"
              value={applicant.job}
              onChange={(job) => {
                setApplicant(i, { job });
              }}
            />
            <SelectField
              label="Employment"
              options={EMPLOYMENT}
              value={applicant.employment}
              onChange={(employment) => {
                setApplicant(i, { employment });
              }}
            />
            <TextField
              label="Net monthly income (€)"
              inputMode="decimal"
              placeholder="€ after tax"
              value={draft.income[i] ?? ""}
              error={field("netIncomeCents")}
              onChange={(text) => {
                setIncome(i, text);
              }}
            />
            {i === 1 && (
              <Button onClick={removeCoApplicant}>Remove co-applicant</Button>
            )}
          </Card>
        );
      })}
      {applicants.length === 1 && (
        <Button kind="add" onClick={addCoApplicant}>
          <PlusIcon />
          Add co-applicant
        </Button>
      )}
    </>
  );
}

export function HouseholdSection({ draft, onChange, errors }: SectionProps) {
  const { household, contact } = draft.profile;
  const pet = household.pets[0];

  const setHousehold = (change: Partial<Profile["household"]>): void => {
    onChange(withProfile(draft, { household: { ...household, ...change } }));
  };
  const setContact = (change: Partial<Profile["contact"]>): void => {
    onChange(withProfile(draft, { contact: { ...contact, ...change } }));
  };
  // The form edits the first pet entry; any further entries (from an
  // import) are kept as they are.
  const setPet = (change: Partial<NonNullable<typeof pet>>): void => {
    if (!pet) return;
    setHousehold({ pets: [{ ...pet, ...change }, ...household.pets.slice(1)] });
  };

  return (
    <>
      {/* Stepper tiles sit on the panel, not in a card: cards never nest. */}
      <div className={styles.tiles}>
        <Stepper
          label="Adults"
          value={household.adults}
          min={Math.max(1, draft.profile.applicants.length)}
          max={MAX_ADULTS}
          decreaseLabel="Fewer adults"
          increaseLabel="More adults"
          onChange={(adults) => {
            setHousehold({ adults });
          }}
        />
        <Stepper
          label="Children"
          value={household.children}
          min={0}
          max={MAX_CHILDREN}
          decreaseLabel="Fewer children"
          increaseLabel="More children"
          onChange={(children) => {
            setHousehold({ children });
          }}
        />
        {pet && (
          <Stepper
            label="Pets"
            value={pet.count}
            min={1}
            max={MAX_PETS}
            decreaseLabel="Fewer pets"
            increaseLabel="More pets"
            onChange={(count) => {
              setPet({ count });
            }}
          />
        )}
      </div>
      <FieldNote error={errors["household.adults"]} />

      <Card title="Pets and smoking">
        <ChipRow>
          <ToggleChip
            pressed={pet !== undefined}
            onToggle={() => {
              setHousehold({
                pets: pet ? [] : [{ kind: "dog", count: 1 }],
              });
            }}
          >
            Pets
          </ToggleChip>
          <ToggleChip
            pressed={household.smoker}
            onToggle={() => {
              setHousehold({ smoker: !household.smoker });
            }}
          >
            Someone smokes
          </ToggleChip>
        </ChipRow>
        {pet && (
          <SelectField
            label="Kind of pet"
            options={PET_KINDS}
            value={pet.kind}
            onChange={(kind) => {
              setPet({ kind });
            }}
          />
        )}
      </Card>

      <Card title="Move-in and budget">
        <TextField
          label="Move-in date"
          type="date"
          value={moveInDateOf(draft.profile.moveIn) ?? ""}
          onChange={(value) => {
            const profile = { ...draft.profile };
            if (value === "") delete profile.moveIn;
            else profile.moveIn = { kind: "date", date: value };
            onChange({ ...draft, profile });
          }}
        />
        <TextField
          label="Max Warmmiete (€)"
          inputMode="decimal"
          placeholder="e.g. 1.300"
          value={draft.budget}
          error={errors.budgetWarmCents}
          onChange={(budget) => {
            onChange({ ...draft, budget });
          }}
        />
        <ChipRow>
          <ToggleChip
            pressed={draft.profile.hasWbs}
            onToggle={() => {
              onChange(withProfile(draft, { hasWbs: !draft.profile.hasWbs }));
            }}
          >
            I have a WBS
          </ToggleChip>
        </ChipRow>
      </Card>

      <Card title="Contact details">
        <p className={cx(styles.note, "type-body-sm")}>
          For the listing&apos;s contact form. Landlords reply here.
        </p>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={contact.email}
          error={errors["contact.email"]}
          onChange={(email) => {
            setContact({ email });
          }}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={contact.phone}
          onChange={(phone) => {
            setContact({ phone });
          }}
        />
        <div className={styles.wideNarrow}>
          <TextField
            label="Street"
            autoComplete="address-line1"
            value={contact.street}
            onChange={(street) => {
              setContact({ street });
            }}
          />
          <TextField
            label="No."
            value={contact.houseNumber}
            onChange={(houseNumber) => {
              setContact({ houseNumber });
            }}
          />
        </div>
        <div className={styles.narrowWide}>
          <TextField
            label="Postcode"
            autoComplete="postal-code"
            inputMode="numeric"
            value={contact.postcode}
            onChange={(postcode) => {
              setContact({ postcode });
            }}
          />
          <TextField
            label="City"
            autoComplete="address-level2"
            value={contact.city}
            onChange={(city) => {
              setContact({ city });
            }}
          />
        </div>
      </Card>
    </>
  );
}

export function DocumentsSection({ draft, onChange }: SectionProps) {
  const { documents } = draft.profile;
  return (
    <Card title="Documents">
      <p className={cx(styles.note, "type-body-sm")}>
        Mark what you have ready. Kiezpigeon keeps only this checklist, never
        the files.
      </p>
      <ChipRow label="Documents ready">
        {DOCUMENTS.map(({ type, label }) => (
          <DocumentChip
            key={type}
            ready={documents[type] === "ready"}
            onToggle={() => {
              onChange(
                withProfile(draft, {
                  documents: {
                    ...documents,
                    [type]: documents[type] === "ready" ? "pending" : "ready",
                  },
                }),
              );
            }}
          >
            {label}
          </DocumentChip>
        ))}
      </ChipRow>
    </Card>
  );
}

export function LetterDefaultsSection({ draft, onChange }: SectionProps) {
  const { letterDefaults } = draft.profile;
  return (
    <Card title="Letter defaults">
      <SegmentedControl
        label="Tone"
        options={TONES}
        value={letterDefaults.tone}
        onChange={(tone) => {
          onChange(
            withProfile(draft, { letterDefaults: { ...letterDefaults, tone } }),
          );
        }}
      />
      <SegmentedControl
        label="Language"
        options={LANGUAGES}
        value={letterDefaults.language}
        onChange={(language) => {
          onChange(
            withProfile(draft, {
              letterDefaults: { ...letterDefaults, language },
            }),
          );
        }}
      />
    </Card>
  );
}

function FieldNote({ error }: { error?: string | undefined }) {
  if (!error) return null;
  return (
    <p className={cx(styles.error, "type-caption")} role="status">
      <ExclamationIcon />
      {error}
    </p>
  );
}
