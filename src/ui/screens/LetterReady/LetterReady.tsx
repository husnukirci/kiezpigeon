// "Letter ready" (design system screen 3): the letter on paper, its checks,
// Rewrite / Edit / Copy, the tone switch, which writes it again, and the
// form fields card. Edits are re-checked as you type, and Fill the form
// writes the letter as edited. On an unknown site the card lists every pair
// first and Fill the form writes only those left on (ADR 12). The user
// presses Send on the page, then tells the panel so it can be tracked.
import { useState } from "react";
import { fillSteps, type FillReport, type FillStep } from "../../../fill/fill";
import { mapFields } from "../../../rules/fieldMatch";
import { countWords, validateLetter } from "../../../rules/letterValidate";
import type {
  Application,
  LetterRequest,
  Profile,
  Tone,
} from "../../../rules/types";
import { describeProblem, type LetterDraft } from "../../../rules/writeLetter";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { LetterCard } from "../../components/Card/LetterCard";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { cx } from "../../cx";
import type { ContactFormState } from "../../hooks/useContactForm";
import type { LetterState } from "../../hooks/useLetter";
import { TONES } from "../profileForm/ProfileSections";
import screen from "../Screen.module.css";
import { FormCard } from "./FormCard";
import styles from "./LetterReady.module.css";
import { SentCard } from "./SentCard";

interface LetterReadyProps {
  state: Exclude<LetterState, { status: "idle" }>;
  profile: Profile;
  listingTitle: string | undefined;
  form: ContactFormState;
  /** An unknown site: list the pairs for the user to confirm first. */
  confirmFirst?: boolean;
  onCheckForm: () => void;
  /** Fills the page's form, the one with these keys; never sends it. */
  onFill: (steps: FillStep[], formKeys: string[]) => void;
  /** Writes the letter again in another tone. */
  onTone: (tone: Tone) => void;
  /** Writes the letter again in the same tone. */
  onRewrite: () => void;
  onBack: () => void;
  /** The tracker's record for this listing, once the user saved one. */
  saved?: Application | undefined;
  /** Why saving it failed, if it did. */
  saveFailed?: string | undefined;
  /** "Yes, I sent it", with the letter as it went into the form. */
  onSent: (letter: string) => void;
}

export function LetterReady({
  state,
  profile,
  listingTitle,
  form,
  confirmFirst = false,
  onCheckForm,
  onFill,
  onTone,
  onRewrite,
  onBack,
  saved,
  saveFailed,
  onSent,
}: LetterReadyProps) {
  // Edits belong to one draft; a new draft starts clean.
  const [edit, setEdit] = useState<{ of: LetterDraft; text: string }>();
  const draft = state.status === "ready" ? state.draft : undefined;
  const text = draft && (edit?.of === draft ? edit.text : draft.text);
  const match =
    text !== undefined && form.status === "form"
      ? mapFields(form.fields, profile, text)
      : undefined;
  // Keys of the fields the user switched off; the list and the fill both
  // read this one set and this one mapping. The set belongs to one form:
  // when the page's fields change, a key may name another field.
  const formKeys =
    form.status === "form" ? form.fields.map((field) => field.key) : [];
  const formId = formKeys.join("\n");
  const [choice, setChoice] = useState<{
    of: string;
    optedOut: ReadonlySet<string>;
  }>();
  const optedOut = choice?.of === formId ? choice.optedOut : new Set<string>();
  const steps = match ? fillSteps(match.mappings, optedOut) : [];
  // The letter now in the page's form: the text of the last click on Fill
  // the form whose own report says it wrote. The previous report stays on
  // screen while a fill runs, so a click remembers the report it saw and
  // only a new one counts. Checking the form again drops the report, not
  // the letter in the form, so the question stays.
  const report = form.status === "form" ? form.report : undefined;
  const [pending, setPending] = useState<{ text: string; seen?: FillReport }>();
  const [written, setWritten] = useState<string>();
  if (pending && report && report !== pending.seen) {
    setPending(undefined);
    if (report.filled.length > 0) setWritten(pending.text);
  }
  const confirm = confirmFirst
    ? {
        optedOut,
        onToggle: (key: string) => {
          const next = new Set(optedOut);
          if (!next.delete(key)) next.add(key);
          setChoice({ of: formId, optedOut: next });
        },
      }
    : undefined;

  return (
    <section className={screen.screen} aria-labelledby="letter-title">
      <div className={screen.heading}>
        <h1 id="letter-title" className={cx(screen.title, "type-title-lg")}>
          {state.status === "ready" ? "Letter ready" : "Your letter"}
        </h1>
        {listingTitle && (
          <p className={cx(screen.lead, "type-body-sm")}>{listingTitle}</p>
        )}
      </div>

      <SegmentedControl
        label="Tone"
        options={TONES}
        value={state.request.tone}
        onChange={onTone}
      />

      {state.status === "writing" && (
        <LetterCard>
          <p className={styles.waiting} role="status">
            Writing your letter. This takes a few seconds.
          </p>
        </LetterCard>
      )}

      {state.status === "failed" && (
        <Card title="Your letter could not be written">
          <p className={cx(styles.failure, "type-body-sm")} role="alert">
            <ExclamationIcon size={18} />
            {state.message}
          </p>
          <Button onClick={onRewrite}>Try again</Button>
        </Card>
      )}

      {state.status === "ready" && text !== undefined && (
        <>
          <ReadyLetter
            draft={state.draft}
            text={text}
            onEdit={(edited) => {
              setEdit({ of: state.draft, text: edited });
            }}
            request={state.request}
            onRewrite={onRewrite}
          />
          <FormCard
            state={form}
            match={match}
            onCheck={onCheckForm}
            confirm={confirm}
          />
          {(saved || written !== undefined) && (
            <SentCard
              saved={saved}
              failed={saveFailed}
              onSent={() => {
                if (written !== undefined) onSent(written);
              }}
            />
          )}
        </>
      )}

      <div className={cx(screen.actions, styles.bottom)}>
        <Button className={screen.back} onClick={onBack}>
          Back
        </Button>
        <Button
          kind="primary"
          disabled={steps.length === 0}
          aria-describedby="send-reminder"
          onClick={() => {
            if (text !== undefined) setPending({ text, seen: report });
            onFill(steps, formKeys);
          }}
        >
          Fill the form
        </Button>
      </div>
      <p id="send-reminder" className={cx(styles.next, "type-caption")}>
        You review and press Send yourself.
      </p>
    </section>
  );
}

interface ReadyLetterProps {
  draft: LetterDraft;
  /** The draft's text as the user edited it. */
  text: string;
  onEdit: (text: string) => void;
  request: LetterRequest;
  onRewrite: () => void;
}

function ReadyLetter({
  draft,
  text,
  onEdit,
  request,
  onRewrite,
}: ReadyLetterProps) {
  // The editor and the copy note belong to one draft, like the edits.
  const [editingOf, setEditingOf] = useState<LetterDraft>();
  const [copy, setCopy] = useState<{ text: string; ok: boolean }>();
  const editing = editingOf === draft;
  const problems = validateLetter(text, request);
  const words = countWords(text);

  const onCopy = (): void => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopy({ text, ok: true });
      },
      () => {
        setCopy({ text, ok: false });
      },
    );
  };

  return (
    <>
      <LetterCard>
        {editing ? (
          <label className={styles.editLabel}>
            <span className="type-caption">Edit your letter</span>
            <textarea
              className={cx(styles.editor, "type-body-sm")}
              value={text}
              // The user just asked to edit; take them to the text.
              autoFocus
              onChange={(e) => {
                onEdit(e.target.value);
              }}
            />
          </label>
        ) : (
          <p className={styles.text}>{text}</p>
        )}
      </LetterCard>

      <div
        className={styles.checks}
        // Announced when a new letter arrives, not on every keystroke.
        aria-live={editing ? "off" : "polite"}
      >
        <p className={cx(styles.count, "type-caption")}>{words} words</p>
        <ul className={styles.lines}>
          {problems.length === 0 ? (
            <li className={cx(styles.line, "type-body-sm")}>
              <TickIcon size={18} />
              Passes every letter check
            </li>
          ) : (
            problems.map((problem) => (
              <li
                key={`${problem.code}:${problem.text}`}
                className={cx(styles.line, "type-body-sm")}
              >
                <ExclamationIcon size={18} />
                {describeProblem(problem)}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className={styles.row}>
        <Button onClick={onRewrite}>Rewrite</Button>
        <Button
          aria-pressed={editing}
          onClick={() => {
            setEditingOf(editing ? undefined : draft);
          }}
        >
          Edit
        </Button>
        <Button onClick={onCopy}>Copy</Button>
      </div>
      <p className={cx(styles.copied, "type-caption")} aria-live="polite">
        {copy?.text !== text
          ? ""
          : copy.ok
            ? "Copied. Paste it into the listing's message field."
            : "Copying did not work. Select the text and copy it yourself."}
      </p>
    </>
  );
}
