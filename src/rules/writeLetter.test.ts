import { describe, expect, it } from "vitest";
import { passingLetter } from "../../test-support/sample-letters";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { buildLetterPrompt, createLetterRequest } from "./letterPrompt";
import { countWords } from "./letterValidate";
import type { LetterPrompt } from "./letterPrompt";
import { buildRetryPrompt, describeProblem, writeLetter } from "./writeLetter";

const request = createLetterRequest(coupleWithDog, kreuzbergListing, {
  tone: "warm",
  features: ["Balkon", "Altbau"],
});

const tooShort =
  "Sehr geehrte Frau Weber,\n\nwir mögen den Balkon und den Altbau mit unserem Hund.";

const shortBy = {
  code: "too_short",
  text: `${countWords(tooShort)} words`,
} as const;

/** A generator that answers with the given letters in turn. */
function scripted(...letters: string[]) {
  const prompts: LetterPrompt[] = [];
  const generate = (prompt: LetterPrompt): Promise<string> => {
    prompts.push(prompt);
    const next = letters[prompts.length - 1];
    return next === undefined
      ? Promise.reject(new Error("no more letters"))
      : Promise.resolve(next);
  };
  return { generate, prompts };
}

describe("describeProblem", () => {
  it("says each problem in one plain sentence", () => {
    expect(describeProblem({ code: "too_short", text: "98 words" })).toBe(
      "The letter has 98 words; it needs 120 to 180.",
    );
    expect(describeProblem({ code: "too_long", text: "201 words" })).toBe(
      "The letter has 201 words; it needs 120 to 180.",
    );
    expect(describeProblem({ code: "em_dash", text: "Altbau – sofort" })).toBe(
      'A dash is used as punctuation in "Altbau – sofort". Use a comma or a full stop.',
    );
    expect(describeProblem({ code: "unknown_number", text: "999" })).toBe(
      "The number 999 is not in the facts.",
    );
    expect(describeProblem({ code: "wrong_salutation", text: "Hallo," })).toBe(
      'The first line "Hallo," is not the right salutation.',
    );
    expect(describeProblem({ code: "pets_missing", text: "Hund" })).toBe(
      "The Hund is not mentioned.",
    );
    expect(describeProblem({ code: "pets_invented", text: "Katze" })).toBe(
      "Katze is mentioned, but the household has no pets.",
    );
    expect(describeProblem({ code: "feature_missing", text: "Balkon" })).toBe(
      "The highlight Balkon is not mentioned.",
    );
  });
});

describe("buildRetryPrompt", () => {
  it("keeps the rules and adds the letter and its problems to the facts", () => {
    const first = buildLetterPrompt(request);
    const retry = buildRetryPrompt(request, tooShort, [
      { code: "too_short", text: "12 words" },
    ]);
    expect(retry.system).toBe(first.system);
    expect(retry.user.startsWith(first.user)).toBe(true);
    expect(retry.user).toContain(
      "Your previous letter broke these rules:\n- The letter has 12 words; it needs 120 to 180.",
    );
    expect(retry.user).toContain(`Previous letter:\n${tooShort}`);
    expect(retry.user.trimEnd()).toMatch(/Write the whole letter again.*\.$/);
  });
});

describe("writeLetter", () => {
  it("returns a valid first letter without a retry", async () => {
    const { generate, prompts } = scripted(passingLetter);
    expect(await writeLetter(request, generate)).toEqual({
      text: passingLetter,
      problems: [],
      attempts: 1,
    });
    expect(prompts).toEqual([buildLetterPrompt(request)]);
  });

  it("retries once with the problems and returns the fixed letter", async () => {
    const { generate, prompts } = scripted(tooShort, passingLetter);
    const draft = await writeLetter(request, generate);
    expect(draft).toEqual({ text: passingLetter, problems: [], attempts: 2 });
    expect(prompts[1]).toEqual(buildRetryPrompt(request, tooShort, [shortBy]));
  });

  it("returns the second letter with its problems when it is still invalid", async () => {
    const { generate, prompts } = scripted(tooShort, tooShort);
    const draft = await writeLetter(request, generate);
    expect(draft.attempts).toBe(2);
    expect(draft.text).toBe(tooShort);
    expect(draft.problems).toEqual([shortBy]);
    expect(prompts).toHaveLength(2);
  });

  it("trims whitespace around the generated letter", async () => {
    const { generate } = scripted(`\n${passingLetter}\n\n`);
    expect((await writeLetter(request, generate)).text).toBe(passingLetter);
  });

  it("lets a failed generation reject", async () => {
    const { generate } = scripted();
    await expect(writeLetter(request, generate)).rejects.toThrow(
      "no more letters",
    );
  });
});
