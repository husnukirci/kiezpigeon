import { describeFields } from "../fill/describe";
import type { FormField } from "../rules/types";

/** The text of the first match, whitespace collapsed; no match or no text is `undefined`. */
export function textOf(
  document: Document,
  selector: string,
): string | undefined {
  const text = document
    .querySelector(selector)
    ?.textContent.replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

export function map<T, U>(
  value: T | undefined,
  f: (value: T) => U,
): U | undefined {
  return value === undefined ? undefined : f(value);
}

/** The fields of a contact form, or none when the page has no form. */
export function readFormFields(form: HTMLFormElement | undefined): FormField[] {
  return form ? describeFields(form) : [];
}
