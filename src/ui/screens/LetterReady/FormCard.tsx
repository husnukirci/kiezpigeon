// The form fields card (design system screen 3): the match pill, what the
// user still fills, what a fill would replace, the opt-ins left alone, and
// what the last fill did. On an unknown site (ADR 12) it first lists every
// pair it would fill, each one a toggle the user can switch off. It reads;
// LetterReady's button fills.
import { formatDate } from "../../../rules/format";
import { countWords } from "../../../rules/letterValidate";
import type { FieldMapping, FormField } from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import {
  ExclamationIcon,
  RingIcon,
  TickIcon,
} from "../../components/Icons/Icons";
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

/** The field's label without the site's required star, else its hint. */
function fieldName(field: FormField): string {
  const label = field.label?.replace(/\s*\*$/, "");
  return label ?? field.placeholder ?? field.name ?? field.key;
}

const names = (fields: FormField[]): string =>
  `${fields.map(fieldName).join(", ")}.`;

/** The per-field confirm on an unknown site: keys the user switched off. */
export interface FillConfirm {
  optedOut: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

interface FormCardProps {
  state: ContactFormState;
  match: FormMatch | undefined;
  onCheck: () => void;
  /** Set on an unknown site: the pairs are listed for the user to confirm. */
  confirm?: FillConfirm | undefined;
}

export function FormCard({ state, match, onCheck, confirm }: FormCardProps) {
  const messages = confirm ? UNKNOWN_SITE_MESSAGES : MESSAGES;
  return (
    <Card
      title="Form fields"
      aside={match && <MatchPill matched={match.matched} total={match.total} />}
    >
      <div aria-live="polite">
        {state.status === "form" ? (
          match && <FormLines state={state} match={match} confirm={confirm} />
        ) : (
          <p className={cx(styles.formNote, "type-body-sm")}>
            {messages[state.status]}
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

const UNKNOWN_SITE_MESSAGES: typeof MESSAGES = {
  checking: MESSAGES.checking,
  no_form:
    "No contact form found on this page. If the site opens its form with a button, open it, then check the form. You can also copy your letter.",
  unreachable:
    "Kiezpigeon cannot read this page any more. Click the Kiezpigeon icon in the toolbar, then check the form.",
};

/** A planned value as the user would recognise it on the page. */
function shown(mapping: FieldMapping): string {
  const { field, kind, value } = mapping;
  if (kind === "message" && typeof value === "string") {
    return `your letter (${countWords(value)} words)`;
  }
  if (typeof value === "boolean") return value ? "ticked" : "not ticked";
  const text = String(value);
  if (field.type === "select") {
    return field.options?.find((o) => o.value === text)?.label ?? text;
  }
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return formatDate(text);
  }
  return text;
}

function FormLines({
  state,
  match,
  confirm,
}: {
  state: Extract<ContactFormState, { status: "form" }>;
  match: FormMatch;
  confirm: FillConfirm | undefined;
}) {
  const unmatched = match.mappings
    .filter((m) => m.value === undefined)
    .map((m) => m.field);
  const replaced = match.mappings
    .filter((m) => m.replaces && !confirm?.optedOut.has(m.field.key))
    .map((m) => m.field);
  const { report } = state;
  const skipped = report?.skipped.map((s) => s.key) ?? [];
  const notFilled = match.mappings
    .map((m) => m.field)
    .filter((f) => skipped.includes(f.key));

  return (
    <>
      {confirm && <PairList mappings={match.mappings} confirm={confirm} />}
      <FillLines
        filled={report?.filled.length}
        notFilled={notFilled}
        unmatched={unmatched}
        replaced={replaced}
        leftAlone={match.leftAlone}
      />
    </>
  );
}

/** Every pair a fill would write, "label → value", each one switchable. */
function PairList({
  mappings,
  confirm,
}: {
  mappings: FieldMapping[];
  confirm: FillConfirm;
}) {
  const planned = mappings.filter((m) => m.value !== undefined);
  if (planned.length === 0) return null;
  return (
    <>
      <p className={cx(styles.formNote, "type-body-sm")}>
        Fill the form writes these. Switch off any field you want to leave as it
        is.
      </p>
      <ul className={styles.pairs}>
        {planned.map((m) => {
          const on = !confirm.optedOut.has(m.field.key);
          return (
            <li key={m.field.key}>
              <button
                type="button"
                className={cx(styles.pair, "type-body-sm")}
                aria-pressed={on}
                onClick={() => {
                  confirm.onToggle(m.field.key);
                }}
              >
                {on ? <TickIcon size={18} /> : <RingIcon size={18} />}
                <span>
                  {fieldName(m.field)} → {shown(m)}
                  {!on && (
                    <span className={cx(styles.off, "type-caption")}>
                      Left as it is
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface FillLinesProps {
  /** How many fields the last fill wrote, if there was one. */
  filled: number | undefined;
  notFilled: FormField[];
  unmatched: FormField[];
  replaced: FormField[];
  leftAlone: FormField[];
}

function FillLines({
  filled,
  notFilled,
  unmatched,
  replaced,
  leftAlone,
}: FillLinesProps) {
  return (
    <ul className={styles.lines}>
      {filled !== undefined && (
        <li className={cx(styles.line, "type-body-sm")}>
          <TickIcon size={18} />
          Filled {filled} {filled === 1 ? "field" : "fields"}. Check them on the
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
      {leftAlone.length > 0 && (
        <li className={cx(styles.line, "type-body-sm")}>
          <TickIcon size={18} />
          Left as you set them: {names(leftAlone)}
        </li>
      )}
    </ul>
  );
}
