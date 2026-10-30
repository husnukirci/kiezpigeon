// StatusPill (design system components/StatusPill/README.md): the detected
// badge, the form's match count and an application's Sent, Viewing or
// Closed. The word carries the meaning, colour reinforces.
import type { ApplicationStatus } from "../../../rules/types";
import { cx } from "../../cx";
import styles from "./StatusPill.module.css";

/** "Listing detected · ImmoScout24", or another label for typed facts. */
export function DetectedBadge({
  siteName,
  label = "Listing detected",
}: {
  siteName: string;
  label?: string;
}) {
  return (
    <p className={cx(styles.pill, styles.detected, "type-caption")}>
      <span className={styles.dot} aria-hidden="true" />
      {label} · {siteName}
    </p>
  );
}

/** "8 of 9 matched": the matcher's numbers, as they are. */
export function MatchPill({
  matched,
  total,
}: {
  matched: number;
  total: number;
}) {
  return (
    <p className={cx(styles.pill, styles.matched, "type-caption")}>
      {matched} of {total} matched
    </p>
  );
}

export const STATUS_WORD: Record<ApplicationStatus, string> = {
  sent: "Sent",
  viewing: "Viewing",
  closed: "Closed",
};

/** An application's status: teal Viewing, violet Sent, night Closed. */
export function ApplicationPill({ status }: { status: ApplicationStatus }) {
  return (
    <p className={cx(styles.pill, styles[status], "type-caption")}>
      {STATUS_WORD[status]}
    </p>
  );
}
