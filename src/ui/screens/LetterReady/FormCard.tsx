// The form fields card (design system screen 3): the match pill, what the
// user still fills, what a fill would replace, the opt-ins left alone, and
// what the last fill did. It reads; LetterReady's button fills.
import type { FieldMapping, FormField } from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { MatchPill } from "../../components/StatusPill/StatusPill";
import { cx } from "../../cx";
import type { ContactFormState } from "../../hooks/useContactForm";
import styles from "./LetterReady.module.css";

export interface FormMatch {
  mappings: FieldMapping[];
  matched: number;
  total: number;
  leftAlone: FormField[];
}

/** The field's label without the site's required star. */
function fieldName(field: FormField): string {
  const label = field.label?.replace(/\s*\*$/, "");
  return label ?? field.name ?? field.key;
}

const names = (fields: FormField[]): string =>
  `${fields.map(fieldName).join(", ")}.`;

interface FormCardProps {
  state: ContactFormState;
  match: FormMatch | undefined;
  onCheck: () => void;
}

export function FormCard({ state, match, onCheck }: FormCardProps) {
  return (
    <Card
      title="Form fields"
      aside={match && <MatchPill matched={match.matched} total={match.total} />}
    >
      <div aria-live="polite">
        {state.status === "form" ? (
          match && <FormLines state={state} match={match} />
        ) : (
          <p className={cx(styles.formNote, "type-body-sm")}>
            {MESSAGES[state.status]}
          </p>
        )}
      </div>
      <Button onClick={onCheck} disabled={state.status === "checking"}>
        Check the form
      </Button>
    </Card>
  );
}

const MESSAGES: Record<Exclude<ContactFormState["status"], "form">, string> = {
  checking: "Looking for the contact form.",
  no_form:
    "Open the contact form on the listing first: press Nachricht on the page. Then check the form here.",
  unreachable:
    "Kiezpigeon cannot reach this page. Reload it, then check the form.",
};

function FormLines({
  state,
  match,
}: {
  state: Extract<ContactFormState, { status: "form" }>;
  match: FormMatch;
}) {
  const unmatched = match.mappings
    .filter((m) => m.value === undefined)
    .map((m) => m.field);
  const replaced = match.mappings.filter((m) => m.replaces).map((m) => m.field);
  const { report } = state;
  const skipped = report?.skipped.map((s) => s.key) ?? [];
  const notFilled = match.mappings
    .map((m) => m.field)
    .filter((f) => skipped.includes(f.key));

  return (
    <ul className={styles.lines}>
      {report && (
        <li className={cx(styles.line, "type-body-sm")}>
          <TickIcon size={18} />
          Filled {report.filled.length}{" "}
          {report.filled.length === 1 ? "field" : "fields"}. Check them on the
          page.
        </li>
      )}
      {notFilled.length > 0 && (
        <li className={cx(styles.line, "type-body-sm")}>
          <ExclamationIcon size={18} />
          Could not fill: {names(notFilled)}
        </li>
      )}
      {unmatched.length > 0 && (
        <li className={cx(styles.line, "type-body-sm")}>
          <ExclamationIcon size={18} />
          Fill these yourself: {names(unmatched)}
        </li>
      )}
      {replaced.length > 0 && (
        <li className={cx(styles.line, "type-body-sm")}>
          <ExclamationIcon size={18} />
          Replaces what the page already has: {names(replaced)}
        </li>
      )}
      {match.leftAlone.length > 0 && (
        <li className={cx(styles.line, "type-body-sm")}>
          <TickIcon size={18} />
          Left as you set them: {names(match.leftAlone)}
        </li>
      )}
    </ul>
  );
}
