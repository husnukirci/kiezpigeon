// The design system's filled glyphs (README "Iconography"): a tick in a teal
// disc, an exclamation in a sun disc, a plus of two rounded bars. Always
// decorative; the text next to them carries the meaning.
import styles from "./Icons.module.css";

interface IconProps {
  size?: number;
}

export function TickIcon({ size = 14 }: IconProps) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle className={styles.teal} cx="8" cy="8" r="8" />
      <rect
        className={styles.onTeal}
        x="4"
        y="7.4"
        width="3.6"
        height="2"
        rx="1"
        transform="rotate(45 5.8 8.4)"
      />
      <rect
        className={styles.onTeal}
        x="6.2"
        y="6.6"
        width="6"
        height="2"
        rx="1"
        transform="rotate(-50 9.2 7.6)"
      />
    </svg>
  );
}

export function ExclamationIcon({ size = 14 }: IconProps) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle className={styles.sun} cx="8" cy="8" r="8" />
      <rect
        className={styles.sunDeep}
        x="7"
        y="3.5"
        width="2"
        height="5.5"
        rx="1"
      />
      <circle className={styles.sunDeep} cx="8" cy="11.6" r="1.2" />
    </svg>
  );
}

/** Drawn in the current text colour. */
export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect
        className={styles.current}
        x="8.5"
        y="1"
        width="3"
        height="18"
        rx="1.5"
      />
      <rect
        className={styles.current}
        x="1"
        y="8.5"
        width="18"
        height="3"
        rx="1.5"
      />
    </svg>
  );
}
