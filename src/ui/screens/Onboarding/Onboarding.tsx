// Onboarding (design system screen 1, "Profile setup"): four profile steps
// and an optional "connect Claude" step (ADR 4), with progress segments and
// one teal Continue each. Errors show for a step once the user tries to
// leave it; the profile is stored only after the last.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { defaultProfile } from "../../../rules/profile";
import { write } from "../../../storage/storage";
import { cx } from "../../cx";
import { Button } from "../../components/Button/Button";
import { draftFrom, resolveDraft, type Draft } from "../profileForm/draft";
import {
  ApplicantsSection,
  DocumentsSection,
  HouseholdSection,
  LetterDefaultsSection,
  type SectionProps,
} from "../profileForm/ProfileSections";
import screen from "../Screen.module.css";
import { ClaudeCard } from "../Settings/ClaudeCard";
import styles from "./Onboarding.module.css";

interface Step {
  title: string;
  lead: string;
  Section: (props: SectionProps) => ReactNode;
  /** Error paths this step owns. */
  owns: (field: string) => boolean;
}

const STEPS: readonly Step[] = [
  {
    title: "About you",
    lead: "Tell me once. I'll use it for every letter.",
    Section: ApplicantsSection,
    owns: (field) => field.startsWith("applicants."),
  },
  {
    title: "Your household",
    lead: "Who moves in, when, and how landlords can reach you.",
    Section: HouseholdSection,
    owns: (field) => !field.startsWith("applicants."),
  },
  {
    title: "Your documents",
    lead: "Landlords ask for these. Knowing what's ready helps me write.",
    Section: DocumentsSection,
    owns: () => false,
  },
  {
    title: "Your letters",
    lead: "How I write for you. You can switch per listing.",
    Section: LetterDefaultsSection,
    owns: () => false,
  },
  {
    title: "Connect Claude",
    lead: "I write your letters with Claude. Connect it now, or later in settings.",
    // Saves the key on its own; the profile draft is not involved.
    Section: ClaudeCard,
    owns: () => false,
  },
];

function stepAt(index: number): Step {
  const step = STEPS[index];
  if (!step) throw new RangeError(`No onboarding step ${index}`);
  return step;
}

export function Onboarding() {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(defaultProfile()));
  const [index, setIndex] = useState(0);
  const [tried, setTried] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const title = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const step = stepAt(index);
  const { profile, errors } = resolveDraft(draft);
  const stepErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => step.owns(field)),
  );

  // Keyboard and screen reader users land on the new step's title.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    title.current?.focus();
  }, [index]);

  const next = (): void => {
    if (Object.keys(stepErrors).length > 0) {
      setTried(true);
      // After this render, move to the first field that needs attention.
      setTimeout(() => {
        root.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }
    setTried(false);
    if (index < STEPS.length - 1) {
      setIndex(index + 1);
      return;
    }
    write("profile", profile).catch((error: unknown) => {
      setSaveError(`Your profile could not be saved: ${String(error)}`);
    });
  };

  return (
    <section
      ref={root}
      className={screen.screen}
      aria-labelledby="onboarding-title"
    >
      <div className={screen.heading}>
        <div className={styles.progress} aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cx(styles.segment, i <= index && styles.done)}
            />
          ))}
        </div>
        <p className={cx(styles.count, "type-caption")}>
          Step {index + 1} of {STEPS.length}
        </p>
        <h1
          ref={title}
          id="onboarding-title"
          tabIndex={-1}
          className={cx(screen.title, "type-title-lg")}
        >
          {step.title}
        </h1>
        <p className={cx(screen.lead, "type-body")}>{step.lead}</p>
      </div>

      <step.Section
        draft={draft}
        onChange={setDraft}
        errors={tried ? stepErrors : {}}
      />

      {saveError && (
        <p className={cx(styles.saveError, "type-body-sm")} role="alert">
          {saveError}
        </p>
      )}

      <div className={screen.actions}>
        {index > 0 && (
          <Button
            className={screen.back}
            onClick={() => {
              setTried(false);
              setIndex(index - 1);
            }}
          >
            Back
          </Button>
        )}
        <Button kind="primary" onClick={next}>
          Continue
        </Button>
      </div>
    </section>
  );
}
