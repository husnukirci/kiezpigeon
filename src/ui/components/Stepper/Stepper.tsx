// Stepper (design system components/Stepper/README.md): a tile with a label,
// minus and plus buttons and the value announced politely.
import { useId } from "react";
import { cx } from "../../cx";
import styles from "./Stepper.module.css";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** e.g. "Fewer adults" */
  decreaseLabel: string;
  /** e.g. "More adults" */
  increaseLabel: string;
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const labelId = useId();
  return (
    <div className={styles.tile} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={cx(styles.label, "type-caption")}>
        {label}
      </p>
      <div className={styles.control}>
        <button
          type="button"
          className={cx(styles.step, "type-stat")}
          aria-label={decreaseLabel}
          disabled={value <= min}
          onClick={() => {
            onChange(value - 1);
          }}
        >
          −
        </button>
        <span className={cx(styles.value, "type-stat")} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className={cx(styles.step, "type-stat")}
          aria-label={increaseLabel}
          disabled={value >= max}
          onClick={() => {
            onChange(value + 1);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
