// The Claude client (ADR 4): the only code that talks to the API, run only
// in the service worker with the user's own key. It turns a prompt into a
// letter's text and every failure into a ClaudeError with a message written
// here, so nothing the SDK or the API says (and never the key) reaches the
// panel.
import Anthropic from "@anthropic-ai/sdk";
import type { LetterPrompt } from "../rules/letterPrompt";
import type { ClaudeModel } from "../rules/types";

export const API_ORIGIN = "https://api.anthropic.com";

/** Long enough for adaptive thinking plus a 180-word letter. */
const MAX_TOKENS = 8000;
const TIMEOUT_MS = 60_000;

export type ClaudeErrorCode =
  | "no_key"
  | "invalid_key"
  | "rate_limited"
  | "unavailable"
  | "network"
  | "timeout"
  | "refused"
  | "failed";

export const ERROR_MESSAGES: Record<ClaudeErrorCode, string> = {
  no_key: "Connect Claude in settings to write letters.",
  invalid_key:
    "Claude did not accept your API key. Check it in settings, or create a new one.",
  rate_limited: "Your key hit its rate limit. Wait a minute, then try again.",
  unavailable: "Claude is busy right now. Try again in a minute.",
  network: "Kiezpigeon could not reach Claude. Check your connection.",
  timeout: "Claude took too long to answer. Try again.",
  refused: "Claude declined to write this letter. Try another tone.",
  failed:
    "Claude could not write the letter. Check your key's credit in the Anthropic console, then try again.",
};

export class ClaudeError extends Error {
  readonly code: ClaudeErrorCode;

  constructor(code: ClaudeErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ClaudeError";
    this.code = code;
  }
}

export interface GenerateOptions {
  model: ClaudeModel;
}

export interface ClaudeClient {
  generate(prompt: LetterPrompt, options: GenerateOptions): Promise<string>;
}

interface ClientOptions {
  /** For tests: the fetch the SDK uses. */
  fetch?: typeof fetch;
}

/** Maps any failure from the SDK to one of our codes. Order matters:
 *  the SDK's timeout error is a kind of connection error. */
export function toClaudeError(error: unknown): ClaudeError {
  if (error instanceof ClaudeError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new ClaudeError("invalid_key");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError("invalid_key");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ClaudeError("rate_limited");
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new ClaudeError("unavailable");
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ClaudeError("timeout");
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ClaudeError("network");
  }
  return new ClaudeError("failed");
}

export function createClaudeClient(
  apiKey: string,
  options: ClientOptions = {},
): ClaudeClient {
  const client = new Anthropic({
    apiKey,
    authToken: null,
    // Fixed here, so no environment variable can send the key elsewhere.
    baseURL: API_ORIGIN,
    // Sends the browser-access header the API requires from an extension
    // (ADR 4 probe); the key stays in the service worker regardless.
    dangerouslyAllowBrowser: true,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    logLevel: "off",
    ...(options.fetch && { fetch: options.fetch }),
  });

  return {
    async generate(prompt, { model }) {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
          output_config: { effort: "low" },
        });
      } catch (error) {
        throw toClaudeError(error);
      }
      if (message.stop_reason === "refusal") throw new ClaudeError("refused");
      const text = message.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
      if (message.stop_reason !== "end_turn" || text.trim() === "") {
        throw new ClaudeError("failed");
      }
      return text;
    },
  };
}
