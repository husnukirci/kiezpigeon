// Reads a form's fields into the rules core's plain `FormField`s and finds
// them again by key. Shared by site adapters and, in Phase 6, the fallback
// for unknown sites. Reads only; never changes the page.
import type { FormField } from "../rules/types";

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FIELD_SELECTOR = "input, select, textarea";

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed === "" ? undefined : trimmed;
}

function keyOf(element: FieldElement, index: number): string {
  if (element.name) return `name:${element.name}`;
  if (element.id) return `id:${element.id}`;
  return `index:${index}`;
}

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

function isVisible(element: FieldElement): boolean {
  return (
    !(element instanceof HTMLInputElement && element.type === "hidden") &&
    element.closest("[hidden], [aria-hidden='true']") === null
  );
}

function describe(element: FieldElement, index: number): FormField {
  const field: FormField = {
    key: keyOf(element, index),
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
  } else {
    field.value = element.value;
  }
  return field;
}

function fieldsIn(root: ParentNode): FieldElement[] {
  return Array.from(root.querySelectorAll<FieldElement>(FIELD_SELECTOR));
}

export function describeFields(root: ParentNode): FormField[] {
  return fieldsIn(root).map(describe);
}

/** The element `describeFields` gave this key, if it is still there. */
export function findField(
  root: ParentNode,
  key: string,
): FieldElement | undefined {
  return fieldsIn(root).find((element, index) => keyOf(element, index) === key);
}
