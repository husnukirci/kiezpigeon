// The service worker's answer to generateLetter (ADR 4, ADR 9): the key and
// the model come from storage here, so they never travel in a message, and
// the panel gets either a draft or an error code with our own message.
import type { LetterResult } from "../messaging/messaging";
import { defaultSettings } from "../rules/profile";
import type { LetterRequest } from "../rules/types";
import { writeLetter } from "../rules/writeLetter";
import { read } from "../storage/storage";
import {
  ClaudeError,
  createClaudeClient,
  toClaudeError,
  type ClaudeClient,
} from "./claude";

function failure(error: unknown): LetterResult {
  const { code, message } = toClaudeError(error);
  return { kind: "error", code, message };
}

export async function generateLetter(
  request: LetterRequest,
  createClient: (apiKey: string) => ClaudeClient = createClaudeClient,
): Promise<LetterResult> {
  const key = await read("apiKey");
  if (!key.ok || key.value === undefined) {
    return failure(new ClaudeError("no_key"));
  }
  const settings = await read("settings");
  const { model } =
    settings.ok && settings.value ? settings.value : defaultSettings();
  const client = createClient(key.value);
  try {
    const draft = await writeLetter(request, (prompt) =>
      client.generate(prompt, { model }),
    );
    return { kind: "letter", draft };
  } catch (error) {
    return failure(error);
  }
}
