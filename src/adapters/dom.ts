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

/**
 * The text a person reads inside `root`: no script, style, noscript or
 * template content, whitespace collapsed. The page itself is left alone.
 */
export function visibleText(root: Element): string {
  const copy = root.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll(
    "script, style, noscript, template",
  )) {
    hidden.remove();
  }
  return copy.textContent.replace(/\s+/g, " ").trim();
}

/** The fields of a contact form, or none when the page has no form. */
export function readFormFields(form: HTMLFormElement | undefined): FormField[] {
  return form ? describeFields(form) : [];
}
