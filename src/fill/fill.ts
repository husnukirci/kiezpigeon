// Writes planned values into a form the way a framework-driven page
// accepts them (ADR 11): the element's native value setter, then `input`
// and `change`. It never submits, never clicks, never focuses, never ticks
// a consent box and never touches a file input (CLAUDE.md "Never submit").
import type { FieldKind, FieldValue } from "../rules/types";
import { findField } from "./describe";

export interface FillStep {
  key: string;
  kind: FieldKind;
  value: FieldValue;
}

export type SkipReason = "missing" | "refused" | "no_option";

export interface FillReport {
  filled: string[];
  skipped: { key: string; reason: SkipReason }[];
}

/** Input types Kiezpigeon never writes, whatever a plan says. */
const NEVER_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "password",
  "radio",
]);

/**
 * The setter from the element's prototype, not the instance. React puts a
 * value tracker on the instance; a plain assignment updates it too, and
 * React then sees no change and drops the value (the ADR 11 probe).
 */
function setNative(
  element: HTMLElement,
  property: "value" | "checked",
  value: string | boolean,
): void {
  let proto: object | null = Object.getPrototypeOf(element) as object | null;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, property);
    if (descriptor?.set) {
      descriptor.set.call(element, value);
      return;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
}

function announce(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillOne(root: ParentNode, step: FillStep): SkipReason | undefined {
  const element = findField(root, step.key);
  if (!element) return "missing";
  if (step.kind === "consent" || element.disabled) return "refused";
  if (element instanceof HTMLInputElement && NEVER_TYPES.has(element.type)) {
    return "refused";
  }
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    if (typeof step.value !== "boolean") return "refused";
    setNative(element, "checked", step.value);
  } else if (element instanceof HTMLSelectElement) {
    const value = String(step.value);
    if (!Array.from(element.options).some((o) => o.value === value)) {
      return "no_option";
    }
    setNative(element, "value", value);
  } else {
    setNative(element, "value", String(step.value));
  }
  announce(element);
  return undefined;
}

export function fillForm(
  root: ParentNode,
  steps: readonly FillStep[],
): FillReport {
  const report: FillReport = { filled: [], skipped: [] };
  for (const step of steps) {
    const reason = fillOne(root, step);
    if (reason) report.skipped.push({ key: step.key, reason });
    else report.filled.push(step.key);
  }
  return report;
}
