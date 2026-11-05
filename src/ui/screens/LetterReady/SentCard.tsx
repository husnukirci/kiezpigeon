// After a fill: "Did you send it?". The letter is already in your pigeons,
// marked Filled, from the moment the fill wrote it. Kiezpigeon never sends
// and never claims it was sent; the user says so, and only then is the
// record marked Sent. A listing already past Filled shows its status.
import type { Application } from "../../../rules/types";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { ExclamationIcon, TickIcon } from "../../components/Icons/Icons";
import { STATUS_WORD } from "../../components/StatusPill/StatusPill";
import { cx } from "../../cx";
import styles from "./LetterReady.module.css";

interface SentCardProps {
  /** The tracker's record for this listing, if there is one. */
  saved: Application | undefined;
  /** Why the last save failed, if it did. */
  failed: string | undefined;
  onSent: () => void;
}

export function SentCard({ saved, failed, onSent }: SentCardProps) {
  if (saved && saved.status !== "filled") {
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
      {saved ? (
        <p className={cx(styles.line, "type-body-sm")} role="status">
          <TickIcon size={18} />
          In your pigeons, marked {STATUS_WORD[saved.status]}.
        </p>
      ) : (
        <p className={cx(styles.formNote, "type-body-sm")}>
          Once you have pressed Send on the page, keep this application in your
          pigeons.
        </p>
      )}
      {saved && (
        <p className={cx(styles.formNote, "type-body-sm")}>
          Once you have pressed Send on the page, tell me and I'll mark it sent.
        </p>
      )}
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
