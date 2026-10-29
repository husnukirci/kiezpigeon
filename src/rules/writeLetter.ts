// Generate, validate, retry once (ADR 9). The validator is the guarantee:
// a letter that breaks a rule goes back to the model once with the
// problems named, and if the second letter still breaks one, the user sees
// it with the problems as warnings. The generator is passed in, so this
// stays pure and knows nothing about the network.
import {
  MAX_WORDS,
  MIN_WORDS,
  buildLetterPrompt,
  type LetterPrompt,
} from "./letterPrompt";
import { validateLetter } from "./letterValidate";
import type { LetterProblem, LetterRequest } from "./types";

const MIDDLE_WORDS = (MIN_WORDS + MAX_WORDS) / 2;

export type Generate = (prompt: LetterPrompt) => Promise<string>;

export interface LetterDraft {
  text: string;
  problems: LetterProblem[];
  attempts: 1 | 2;
}

/** One plain sentence per problem, for the retry prompt and the UI. */
export function describeProblem({ code, text }: LetterProblem): string {
  switch (code) {
    case "too_short":
    case "too_long": {
      // The validator writes the count as `98 words`. Aiming at the middle
      // gets a retry clear of the edge it missed.
      const off = Math.abs(MIDDLE_WORDS - Number.parseInt(text, 10));
      const fix = code === "too_short" ? "Add" : "Cut";
      return `The letter has ${text}; it needs ${MIN_WORDS} to ${MAX_WORDS}. ${fix} about ${off} words.`;
    }
    case "em_dash":
      return `A dash is used as punctuation in "${text}". Use a comma or a full stop.`;
    case "unknown_number":
      return `The number ${text} is not in the facts.`;
    case "wrong_salutation":
      return `The first line "${text}" is not the right salutation.`;
    case "pets_missing":
      return `The ${text} is not mentioned.`;
    case "pets_invented":
      return `${text} is mentioned, but the household has no pets.`;
    case "feature_missing":
      return `The highlight ${text} is not mentioned.`;
  }
}

export function buildRetryPrompt(
  request: LetterRequest,
  letter: string,
  problems: readonly LetterProblem[],
): LetterPrompt {
  const first = buildLetterPrompt(request);
  const user = [
    first.user,
    "",
    "Your previous letter broke these rules:",
    ...problems.map((problem) => `- ${describeProblem(problem)}`),
    "",
    "Previous letter:",
    letter,
    "",
    "Write the whole letter again with these problems fixed, keeping every rule.",
  ].join("\n");
  return { system: first.system, user };
}

export async function writeLetter(
  request: LetterRequest,
  generate: Generate,
): Promise<LetterDraft> {
  const first = (await generate(buildLetterPrompt(request))).trim();
  const firstProblems = validateLetter(first, request);
  if (firstProblems.length === 0) {
    return { text: first, problems: [], attempts: 1 };
  }
  const second = (
    await generate(buildRetryPrompt(request, first, firstProblems))
  ).trim();
  return {
    text: second,
    problems: validateLetter(second, request),
    attempts: 2,
  };
}
