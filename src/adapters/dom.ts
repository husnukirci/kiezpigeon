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

const SKIPPED = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

function isHidden(element: Element): boolean {
  return (
    SKIPPED.has(element.tagName) ||
    element.hasAttribute("hidden") ||
    element.getAttribute("aria-hidden") === "true"
  );
}

/**
 * The text a person reads inside `root`: no script, style, noscript or
 * template content and nothing hidden, whitespace collapsed. Element
 * boundaries and `<br>` separate words, so `<dt>Kaltmiete</dt><dd>1 €</dd>`
 * reads "Kaltmiete 1 €". The page itself is left alone.
 */
export function visibleText(root: Element): string {
  const parts: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      parts.push(node.textContent ?? "");
    } else if (node.nodeType === 1) {
      const element = node as Element;
      if (isHidden(element)) return;
      parts.push(" ");
      for (const child of element.childNodes) visit(child);
      parts.push(" ");
    }
  };
  visit(root);
  return parts.join("").replace(/\s+/g, " ").trim();
}

/** The fields of a contact form, or none when the page has no form. */
export function readFormFields(form: HTMLFormElement | undefined): FormField[] {
  return form ? describeFields(form) : [];
}
