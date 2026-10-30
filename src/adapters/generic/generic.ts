// The fallback for sites without an adapter (ADR 12): finds the page's
// contact form among its visible forms and reads it with the shared
// describer. It reads no listing facts; the user types those in the panel.
import type { FormField } from "../../rules/types";
import { describeFields, isVisible } from "../../fill/describe";

/** A form with fewer fields and no message box is a search or a newsletter. */
const MIN_FIELDS_WITHOUT_MESSAGE = 3;

const TYPED =
  "input:not([type=hidden], [type=submit], [type=button], [type=reset], [type=image], [type=file], [type=checkbox], [type=radio]), select, textarea";

function visibleFields(form: HTMLFormElement): Element[] {
  return Array.from(form.querySelectorAll(TYPED)).filter(isVisible);
}

function hasMessageBox(form: HTMLFormElement): boolean {
  return Array.from(form.querySelectorAll("textarea")).some(isVisible);
}

/**
 * The contact form: of the visible forms that ask for no password, one with
 * a message box, else the one with the most fields if it has enough to be
 * more than a search box. The first in the page wins a tie.
 */
function contactForm(document: Document): HTMLFormElement | undefined {
  const candidates = Array.from(document.forms).filter(
    (form) =>
      isVisible(form) &&
      form.querySelector("input[type=password]") === null &&
      (hasMessageBox(form) ||
        visibleFields(form).length >= MIN_FIELDS_WITHOUT_MESSAGE),
  );
  const rank = (form: HTMLFormElement): number =>
    (hasMessageBox(form) ? 1000 : 0) + visibleFields(form).length;
  let best: HTMLFormElement | undefined;
  for (const form of candidates) {
    if (!best || rank(form) > rank(best)) best = form;
  }
  return best;
}

export const generic = {
  contactForm,
  readContactForm: (document: Document): FormField[] => {
    const form = contactForm(document);
    return form ? describeFields(form) : [];
  },
};
