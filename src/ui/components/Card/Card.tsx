// Card (design system components/Card/README.md): a night-700 section with
// a title row and an optional pill on the right. Cards never nest.
import { useId, type ReactNode } from "react";
import { cx } from "../../cx";
import styles from "./Card.module.css";

interface CardProps {
  title: string;
  /** Shown at the right of the title row, e.g. a StatusPill. */
  aside?: ReactNode;
  children: ReactNode;
}

export function Card({ title, aside, children }: CardProps) {
  const headingId = useId();
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 id={headingId} className={cx(styles.title, "type-body")}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
