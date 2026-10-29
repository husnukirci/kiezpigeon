// StatusPill (design system components/StatusPill/README.md): the detected
// badge and the form's match count; the tracker's Sent, Viewing and Closed
// pills arrive with the tracker. The word carries the meaning, colour reinforces.
import { cx } from "../../cx";
import styles from "./StatusPill.module.css";

export function DetectedBadge({ siteName }: { siteName: string }) {
  return (
    <p className={cx(styles.pill, styles.detected, "type-caption")}>
      <span className={styles.dot} aria-hidden="true" />
      Listing detected · {siteName}
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
