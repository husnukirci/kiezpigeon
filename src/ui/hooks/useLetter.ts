// One letter's lifecycle in the panel: write on a click, then ready or
// failed. The service worker does the work (ADR 4); only the latest request
// counts, so switching tone twice never shows the older letter last.
import { useCallback, useRef, useState } from "react";
import { send } from "../../messaging/messaging";
import type { LetterRequest } from "../../rules/types";
import type { LetterDraft } from "../../rules/writeLetter";

export type LetterState =
  | { status: "idle" }
  | { status: "writing"; request: LetterRequest }
  | { status: "ready"; request: LetterRequest; draft: LetterDraft }
  | { status: "failed"; request: LetterRequest; message: string };

/** When the worker itself cannot be reached, not Claude. */
export const WORKER_UNREACHABLE =
  "Kiezpigeon could not start writing. Close the panel, open it again and retry.";

export function useLetter(): {
  state: LetterState;
  write: (request: LetterRequest) => void;
} {
  const [state, setState] = useState<LetterState>({ status: "idle" });
  const latest = useRef(0);

  const write = useCallback((request: LetterRequest): void => {
    const id = ++latest.current;
    setState({ status: "writing", request });
    send({ type: "generateLetter", request }).then(
      (result) => {
        if (id !== latest.current) return;
        setState(
          result.kind === "letter"
            ? { status: "ready", request, draft: result.draft }
            : { status: "failed", request, message: result.message },
        );
      },
      () => {
        if (id !== latest.current) return;
        setState({ status: "failed", request, message: WORKER_UNREACHABLE });
      },
    );
  }, []);

  return { state, write };
}
