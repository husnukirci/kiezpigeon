// Stat tile (design system components/Card/README.md): a number over a
// caption. A value the listing did not show reads "Not shown in listing",
// never 0. The positive tile is teal-deep, e.g. the tracker's viewings.
import type { ReactNode } from "react";
import { cx } from "../../cx";
import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  /** Already formatted; undefined when the listing did not show it. */
  value?: string;
  positive?: boolean;
}

export function StatTile({ label, value, positive = false }: StatTileProps) {
  return (
    <div className={cx(styles.tile, positive && styles.positive)}>
      {value === undefined ? (
        <p className={cx(styles.missing, "type-caption")}>
          Not shown in listing
        </p>
      ) : (
        <p className={cx(styles.value, "type-stat")}>{value}</p>
      )}
      <p className={cx(styles.label, "type-caption")}>{label}</p>
    </div>
  );
}

/** Two or three tiles side by side. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
