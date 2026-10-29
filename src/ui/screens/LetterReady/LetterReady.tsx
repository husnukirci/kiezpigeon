// "Letter ready" (design system screen 3): the letter on paper, its checks,
// Rewrite / Edit / Copy, and the tone switch, which writes it again. Edits
// are re-checked as you type. The form card and Fill the form arrive with
// form filling in Phase 5; until then the button is disabled.
import { useState } from "react";
import { countWords, validateLetter } from "../../../rules/letterValidate";
import type { LetterRequest, Tone } from "../../../rules/types";
import { describeProblem, type LetterDraft } from "../../../rules/writeLetter";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { LetterCard } from "../../components/Card/LetterCard";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { SegmentedControl } from "../../components/SegmentedControl/SegmentedControl";
import { cx } from "../../cx";
import type { LetterState } from "../../hooks/useLetter";
import { TONES } from "../profileForm/ProfileSections";
import screen from "../Screen.module.css";
import styles from "./LetterReady.module.css";

interface LetterReadyProps {
  state: Exclude<LetterState, { status: "idle" }>;
  listingTitle: string | undefined;
  /** Writes the letter again in another tone. */
  onTone: (tone: Tone) => void;
  /** Writes the letter again in the same tone. */
  onRewrite: () => void;
  onBack: () => void;
}

export function LetterReady({
  state,
  listingTitle,
  onTone,
  onRewrite,
  onBack,
}: LetterReadyProps) {
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

      {state.status === "ready" && (
        <ReadyLetter
          draft={state.draft}
          request={state.request}
          onRewrite={onRewrite}
        />
      )}

      <div className={cx(screen.actions, styles.bottom)}>
        <Button className={screen.back} onClick={onBack}>
          Back
        </Button>
        <Button kind="primary" disabled aria-describedby="fill-next">
          Fill the form
        </Button>
      </div>
      <p id="fill-next" className={cx(styles.next, "type-caption")}>
        Coming next
      </p>
    </section>
  );
}

interface ReadyLetterProps {
  draft: LetterDraft;
  request: LetterRequest;
  onRewrite: () => void;
}

function ReadyLetter({ draft, request, onRewrite }: ReadyLetterProps) {
  // Edits and the copy note belong to one draft; a new draft starts clean.
  const [edit, setEdit] = useState<{ of: LetterDraft; text: string }>();
  const [editingOf, setEditingOf] = useState<LetterDraft>();
  const [copy, setCopy] = useState<{ text: string; ok: boolean }>();
  const text = edit?.of === draft ? edit.text : draft.text;
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
                setEdit({ of: draft, text: e.target.value });
              }}
            />
          </label>
        ) : (
          <p className={styles.text}>{text}</p>
        )}
      </LetterCard>

      <div className={styles.checks} aria-live="polite">
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
