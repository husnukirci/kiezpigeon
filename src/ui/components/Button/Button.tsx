// Button (design system components/Button/README.md): one teal primary per
// screen, night secondary buttons, a dashed "add" button and icon buttons.
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../cx";
import styles from "./Button.module.css";

export type ButtonKind = "primary" | "secondary" | "add" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonKind;
}

const TYPE_STYLE: Record<ButtonKind, string | undefined> = {
  primary: "type-button",
  secondary: "type-label",
  add: "type-body",
  icon: undefined,
};

/** The classes of a button kind, for a control that must be another
 *  element, such as the label of a file input. */
export function buttonClassName(kind: ButtonKind): string {
  return cx(styles.button, styles[kind], TYPE_STYLE[kind]);
}

export function Button({
  kind = "secondary",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      // Every button is type="button" unless a caller says otherwise, so
      // none can ever submit a form by accident.
      type={type}
      className={cx(buttonClassName(kind), className)}
      {...rest}
    />
  );
}
