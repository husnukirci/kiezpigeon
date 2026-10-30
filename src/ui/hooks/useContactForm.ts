// The contact form in the panel's tab (ADR 11). The site opens it in a
// dialog the user opens themselves, so the panel reads it when the letter
// screen opens and again on "Check the form". Filling happens only on a
// click, and the form is read again after it so the card shows the page.
// On an unknown site `prepare` injects the fallback reader first (ADR 12).
import { useCallback, useEffect, useRef, useState } from "react";
import type { FillReport, FillStep } from "../../fill/fill";
import { send } from "../../messaging/messaging";
import type { FormField } from "../../rules/types";
import { panelTab } from "./useActiveListing";

export type ContactFormState =
  | { status: "checking" }
  | { status: "no_form" }
  /** No content script answered: a page from before an install or update. */
  | { status: "unreachable" }
  | { status: "form"; fields: FormField[]; report?: FillReport };

/** Runs in the tab before each read and fill; rejects if it cannot. */
export type Prepare = (tabId: number) => Promise<unknown>;

async function read(
  ownTab: number | undefined,
  prepare: Prepare | undefined,
): Promise<ContactFormState> {
  const tabId = await panelTab(ownTab);
  if (tabId === undefined) return { status: "unreachable" };
  await prepare?.(tabId);
  const result = await send({ type: "getContactForm" }, tabId);
  return result.kind === "form"
    ? { status: "form", fields: result.fields }
    : { status: "no_form" };
}

async function fillThenRead(
  ownTab: number | undefined,
  prepare: Prepare | undefined,
  steps: FillStep[],
): Promise<ContactFormState> {
  const tabId = await panelTab(ownTab);
  if (tabId === undefined) return { status: "unreachable" };
  await prepare?.(tabId);
  const result = await send({ type: "fillForm", steps }, tabId);
  if (result.kind === "no_form") return { status: "no_form" };
  const after = await read(ownTab, prepare);
  return after.status === "form" ? { ...after, report: result.report } : after;
}

export function useContactForm(
  ownTab: number | undefined,
  prepare?: Prepare,
): {
  state: ContactFormState;
  check: () => void;
  fill: (steps: FillStep[]) => void;
} {
  const [state, setState] = useState<ContactFormState>({ status: "checking" });
  const latest = useRef(0);

  /** Shows the answer to the latest request only. */
  const settle = useCallback((work: Promise<ContactFormState>): void => {
    const id = ++latest.current;
    work.then(
      (next) => {
        if (id === latest.current) setState(next);
      },
      () => {
        if (id === latest.current) setState({ status: "unreachable" });
      },
    );
  }, []);

  const run = useCallback(
    (work: () => Promise<ContactFormState>): void => {
      // A form already shown stays while it is read again.
      setState((current) =>
        current.status === "form" ? current : { status: "checking" },
      );
      settle(work());
    },
    [settle],
  );

  const check = useCallback(() => {
    run(() => read(ownTab, prepare));
  }, [run, ownTab, prepare]);

  const fill = useCallback(
    (steps: FillStep[]) => {
      run(() => fillThenRead(ownTab, prepare, steps));
    },
    [run, ownTab, prepare],
  );

  // Reading the page the user is on, when its letter screen opens; the
  // state already says "checking".
  useEffect(() => {
    settle(read(ownTab, prepare));
  }, [settle, ownTab, prepare]);

  return { state, check, fill };
}
