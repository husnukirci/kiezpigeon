// Chip (design system components/Chip/README.md). ToggleChip is an
// aria-pressed button; DocumentChip names a document with a tick when
// ready and an exclamation when pending, read-only unless given onToggle.
import type { ReactNode } from "react";
import { cx } from "../../cx";
import { ExclamationIcon, TickIcon } from "../Icons/Icons";
import styles from "./Chip.module.css";

interface ToggleProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ToggleChip({ pressed, onToggle, children }: ToggleProps) {
  return (
    <button
      type="button"
      className={cx(styles.chip, styles.toggle, "type-label")}
      aria-pressed={pressed}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}

interface DocumentChipProps {
  ready: boolean;
  onToggle?: () => void;
  children: ReactNode;
}

export function DocumentChip({ ready, onToggle, children }: DocumentChipProps) {
  const className = cx(
    styles.document,
    ready ? styles.ready : styles.pending,
    "type-label",
  );
  const content = (
    <>
      {ready ? <TickIcon /> : <ExclamationIcon />}
      {children}
    </>
  );
  if (!onToggle) return <span className={className}>{content}</span>;
  return (
    <button
      type="button"
      className={cx(className, styles.chip)}
      aria-pressed={ready}
      onClick={onToggle}
    >
      {content}
    </button>
  );
}

/** Wraps chips with space-2 gaps; never scrolls sideways. */
export function ChipRow({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.row}
      role={label ? "group" : undefined}
      aria-label={label}
    >
      {children}
    </div>
  );
}
