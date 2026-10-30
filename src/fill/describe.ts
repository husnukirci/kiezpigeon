// Reads a form's fields into the rules core's plain `FormField`s and finds
// them again by key. Shared by site adapters and the fallback for unknown
// sites (ADR 12). Reads only; never changes the page.
import type { FormField } from "../rules/types";

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FIELD_SELECTOR = "input, select, textarea";

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * `name:<name>` when the name is unique in the form, else `id:<id>`, else
 * the position, so every key finds exactly one element again.
 */
function keysOf(elements: FieldElement[]): string[] {
  const count = (attribute: "name" | "id", value: string): number =>
    elements.filter((e) => e[attribute] === value).length;
  return elements.map((element, index) => {
    if (element.name && count("name", element.name) === 1) {
      return `name:${element.name}`;
    }
    if (element.id && count("id", element.id) === 1) return `id:${element.id}`;
    return `index:${index}`;
  });
}

/** Inputs whose value is never read: secrets, files, tracking tokens. */
const UNREAD_TYPES = new Set([
  "hidden",
  "password",
  "file",
  "submit",
  "button",
  "reset",
  "image",
]);

/**
 * The field's label: its `<label for>`, then `aria-labelledby` and
 * `aria-label`, then a lone unattached `<label>` close above it (selects
 * on ImmoScout24 have one beside them, without `for`).
 */
function labelOf(element: FieldElement): string | undefined {
  const own = element.labels?.[0];
  if (own) return text(own.textContent);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const byId = element.ownerDocument.getElementById(labelledBy);
    if (byId) return text(byId.textContent);
  }
  const ariaLabel = text(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  let ancestor = element.parentElement;
  for (let depth = 0; ancestor && depth < 3; depth += 1) {
    const labels = ancestor.querySelectorAll("label");
    if (labels.length > 1) return undefined;
    const label = labels[0];
    if (label) return label.htmlFor ? undefined : text(label.textContent);
    ancestor = ancestor.parentElement;
  }
  return undefined;
}

/**
 * Hidden by type, attribute or style. A field a stylesheet hides is often
 * a spam trap that a person never fills, so Kiezpigeon must not either.
 */
export function isVisible(element: Element): boolean {
  return (
    !(element instanceof HTMLInputElement && element.type === "hidden") &&
    element.closest("[hidden], [aria-hidden='true']") === null &&
    element.checkVisibility()
  );
}

/** One element as plain data; `key` is the handle `findField` takes. */
export function describeField(element: FieldElement, key: string): FormField {
  const field: FormField = {
    key,
    type:
      element instanceof HTMLInputElement
        ? element.type
        : element.tagName.toLowerCase(),
    name: text(element.name),
    id: text(element.id),
    autocomplete: text(element.getAttribute("autocomplete")),
    label: labelOf(element),
    placeholder: text(element.getAttribute("placeholder")),
    visible: isVisible(element),
    disabled: element.disabled,
  };
  if (element instanceof HTMLSelectElement) {
    field.options = Array.from(element.options, (option) => ({
      value: option.value,
      label: option.text.trim(),
    }));
  }
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    field.checked = element.checked;
  } else if (!(
    element instanceof HTMLInputElement && UNREAD_TYPES.has(element.type)
  )) {
    field.value = element.value;
  }
  return field;
}

function fieldsIn(root: ParentNode): FieldElement[] {
  return Array.from(root.querySelectorAll<FieldElement>(FIELD_SELECTOR));
}

export function describeFields(root: ParentNode): FormField[] {
  const elements = fieldsIn(root);
  const keys = keysOf(elements);
  return elements.map((element, index) =>
    describeField(element, keys[index] ?? `index:${index}`),
  );
}

/** The element `describeFields` gave this key, if it is still there. */
export function findField(
  root: ParentNode,
  key: string,
): FieldElement | undefined {
  const elements = fieldsIn(root);
  const keys = keysOf(elements);
  return elements.find((_, index) => keys[index] === key);
}
