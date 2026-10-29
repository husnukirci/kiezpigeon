// TextField (design system components/TextField/README.md): the label wraps
// the input; an error turns the border sun and shows a helper line with the
// exclamation icon below. Never red. SelectField is the same field for a
// short fixed list.
import { useId, type InputHTMLAttributes } from "react";
import { cx } from "../../cx";
import { ExclamationIcon } from "../Icons/Icons";
import styles from "./TextField.module.css";

interface FieldProps {
  label: string;
  error?: string | undefined;
}

interface TextFieldProps
  extends
    FieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

export function TextField({
  label,
  error,
  value,
  onChange,
  className,
  ...input
}: TextFieldProps) {
  const errorId = useId();
  return (
    <div className={cx(styles.field, className)}>
      <label className={cx(styles.label, "type-caption")}>
        {label}
        <input
          className={cx(styles.control, error && styles.invalid, "type-body")}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
      </label>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

interface SelectFieldProps<T extends string> extends FieldProps {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  label,
  error,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const errorId = useId();
  return (
    <div className={styles.field}>
      <label className={cx(styles.label, "type-caption")}>
        {label}
        <select
          className={cx(styles.control, error && styles.invalid, "type-body")}
          value={value}
          onChange={(e) => {
            // The options are exactly the T values passed in.
            onChange(e.target.value as T);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string | undefined }) {
  if (!error) return null;
  return (
    <p id={id} className={cx(styles.error, "type-caption")}>
      <ExclamationIcon />
      {error}
    </p>
  );
}
