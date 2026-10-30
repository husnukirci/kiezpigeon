// After a fill: "Did you send it?". Kiezpigeon never sends and never claims
// it was sent; the user says so, and only then is the application saved to
// the tracker. A listing already there shows its status instead.
import type { Application } from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { STATUS_WORD } from "../../components/StatusPill/StatusPill";
import { cx } from "../../cx";
import styles from "./LetterReady.module.css";

interface SentCardProps {
  /** The tracker's record for this listing, if the user saved one. */
  saved: Application | undefined;
  /** Why the last save failed, if it did. */
  failed: string | undefined;
  onSent: () => void;
}

export function SentCard({ saved, failed, onSent }: SentCardProps) {
  if (saved) {
    return (
      <Card title="Did you send it?">
        <p className={cx(styles.line, "type-body-sm")} role="status">
          <TickIcon size={18} />
          In your pigeons, marked {STATUS_WORD[saved.status]}. Change its status
          there.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Did you send it?">
      <p className={cx(styles.formNote, "type-body-sm")}>
        Once you have pressed Send on the page, keep this application in your
        pigeons.
      </p>
      {failed && (
        <p className={cx(styles.failure, "type-body-sm")} role="alert">
          <ExclamationIcon size={18} />
          {failed}
        </p>
      )}
      <Button onClick={onSent}>Yes, I sent it</Button>
    </Card>
  );
}
