// StatusPill (design system components/StatusPill/README.md). Only the
// detected badge so far; the tracker's Sent, Viewing and Closed pills
// arrive with the tracker. The word carries the meaning, colour reinforces.
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
