// The service worker's answer to analyseListing (ADR 4, ADR 14): the key
// comes from storage here, the model is fixed for this call, and the panel
// gets either the sections or an error code with the analysis's own message.
import type { AnalysisResult } from "../messaging/messaging";
import { buildAnalysisPrompt } from "../rules/analysisPrompt";
import { parseAnalysis } from "../rules/analysisParse";
import type { AnalysisRequest, ClaudeModel } from "../rules/types";
import { read } from "../storage/storage";
import {
  ClaudeError,
  createClaudeClient,
  toClaudeError,
  type ClaudeClient,
  type ClaudeErrorCode,
} from "./claude";

/** Whatever `settings.model` says: the analysis always runs on this one. */
export const ANALYSIS_MODEL: ClaudeModel = "claude-opus-5-5";

/** Neutral copy worded for this action; the letter's messages stay as they are. */
export const ANALYSIS_ERROR_MESSAGES: Record<ClaudeErrorCode, string> = {
  no_key: "Connect your key in settings to analyse listings.",
  invalid_key:
    "Your key was not accepted. Check it in settings, or create a new one.",
  rate_limited: "Your key hit its rate limit. Wait a minute, then try again.",
  unavailable: "The analysis is busy right now. Try again in a minute.",
  network: "Kiezpigeon could not reach the analysis. Check your connection.",
  timeout: "The analysis took too long. Try again.",
  refused: "This listing could not be analysed. Try again later.",
  no_credit: "Your account has no credit left. Add credit, then try again.",
  model_unavailable:
    "Your key cannot run the analysis. Check its access in your account.",
  cut_off: "The analysis was cut off. Try again.",
  failed: "The listing could not be analysed. Try again.",
};

function failure(error: unknown): AnalysisResult {
  const { code } = toClaudeError(error);
  return { kind: "error", code, message: ANALYSIS_ERROR_MESSAGES[code] };
}

export async function analyseListing(
  request: AnalysisRequest,
  createClient: (apiKey: string) => ClaudeClient = createClaudeClient,
): Promise<AnalysisResult> {
  const key = await read("apiKey");
  if (!key.ok || key.value === undefined) {
    return failure(new ClaudeError("no_key"));
  }
  const client = createClient(key.value);
  try {
    const text = await client.generate(buildAnalysisPrompt(request), {
      model: ANALYSIS_MODEL,
    });
    return { kind: "analysis", sections: parseAnalysis(text) };
  } catch (error) {
    return failure(error);
  }
}
