// Letter card (design system components/Card/README.md): the one light
// surface in the panel, paper with paper-ink text at body-sm.
import type { ReactNode } from "react";
import { cx } from "../../cx";
import styles from "./LetterCard.module.css";

export function LetterCard({ children }: { children: ReactNode }) {
  return <div className={cx(styles.letter, "type-body-sm")}>{children}</div>;
}
