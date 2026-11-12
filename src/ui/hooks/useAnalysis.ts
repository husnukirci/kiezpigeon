// The analysis of each listing the panel has shown, kept for the panel's
// lifetime (nothing is stored). It lives above the listing screen so Back
// from the letter shows the result again. A result is written under the
// URL it was asked for, so opening another listing meanwhile never shows
// it there.
import { useCallback, useState } from "react";
import { send } from "../../messaging/messaging";
import type { AnalysisSection } from "../../rules/analysisParse";
import { createAnalysisRequest } from "../../rules/analysisRequest";
import type { Listing, Profile } from "../../rules/types";

export type AnalysisState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; sections: AnalysisSection[] }
  | { status: "failed"; message: string };

const NO_TEXT = "Kiezpigeon could not read this page's text.";
/** When the page or the worker cannot be reached. */
const UNREACHABLE =
  "Kiezpigeon could not start the analysis. Close the panel, open it again and retry.";

const IDLE: AnalysisState = { status: "idle" };

/** Results keyed by listing URL for the panel's lifetime. */
export function useAnalysis(
  ownTab: number | undefined,
  profile: Profile,
): {
  stateFor(url: string): AnalysisState;
  analyse(listing: Listing): void;
} {
  const [states, setStates] = useState<ReadonlyMap<string, AnalysisState>>(
    new Map(),
  );

  const put = useCallback((url: string, state: AnalysisState): void => {
    setStates((previous) => new Map(previous).set(url, state));
  }, []);

  const analyse = useCallback(
    (listing: Listing): void => {
      const url = listing.url;
      put(url, { status: "reading" });
      const run = async (): Promise<AnalysisState> => {
        const page = await send({ type: "getPageText" }, ownTab);
        if (page.kind === "no_text")
          return { status: "failed", message: NO_TEXT };
        const result = await send({
          type: "analyseListing",
          request: createAnalysisRequest(profile, listing, page.text),
        });
        return result.kind === "analysis"
          ? { status: "ready", sections: result.sections }
          : { status: "failed", message: result.message };
      };
      run().then(
        (state) => {
          put(url, state);
        },
        () => {
          put(url, { status: "failed", message: UNREACHABLE });
        },
      );
    },
    [ownTab, profile, put],
  );

  const stateFor = useCallback(
    (url: string): AnalysisState => states.get(url) ?? IDLE,
    [states],
  );

  return { stateFor, analyse };
}
