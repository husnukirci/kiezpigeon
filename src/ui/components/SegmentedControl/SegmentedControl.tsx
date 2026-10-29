// SegmentedControl (design system components/SegmentedControl/README.md):
// a single choice of two to four options as aria-pressed buttons in a
// labelled group. Left and right arrows move the selection and the focus.
import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "../../cx";
import styles from "./SegmentedControl.module.css";

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttons.current[next]?.focus();
  };

  return (
    <div className={styles.wrap}>
      <p id={labelId} className={cx(styles.label, "type-label")}>
        {label}
      </p>
      <div className={styles.track} role="group" aria-labelledby={labelId}>
        {options.map((option, i) => (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            className={cx(styles.option, "type-body-sm")}
            aria-pressed={option.value === value}
            onClick={() => {
              onChange(option.value);
            }}
            onKeyDown={(e) => {
              onKeyDown(e, i);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
