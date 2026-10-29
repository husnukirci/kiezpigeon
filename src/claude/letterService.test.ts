import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { passingLetter } from "../../test-support/sample-letters";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { buildLetterPrompt, createLetterRequest } from "../rules/letterPrompt";
import type { Profile } from "../rules/types";
import { resetForTests, writeAll } from "../storage/storage";
import { createClaudeClient } from "./claude";
import { generateLetter } from "./letterService";

const KEY = "FAKE-KEY-0123456789";

/** Values in the profile that are not letter facts, each easy to spot. */
const profile: Profile = {
  ...coupleWithDog,
  budgetWarmCents: 987_600,
  hasWbs: true,
};
const request = createLetterRequest(profile, kreuzbergListing, {
  tone: "warm",
  features: ["Balkon", "Altbau"],
});

function answering(text: string) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-5-5",
          content: [{ type: "text", text }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
}

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});

describe("generateLetter", () => {
  it("answers no_key without calling Claude when no key is stored", async () => {
    const createClient = vi.fn(createClaudeClient);
    expect(await generateLetter(request, createClient)).toEqual({
      kind: "error",
      code: "no_key",
      message: "Connect Claude in settings to write letters.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("writes with the stored key and model and sends only the letter request's facts", async () => {
    await writeAll({ apiKey: KEY, settings: { model: "claude-haiku-5-5" } });
    const fetch = answering(passingLetter);

    const result = await generateLetter(request, (key) =>
      createClaudeClient(key, { fetch }),
    );

    expect(result).toEqual({
      kind: "letter",
      draft: { text: passingLetter, problems: [], attempts: 1 },
    });
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string) as {
      model: string;
      system: string;
      messages: { content: string }[];
    };
    expect(body.model).toBe("claude-haiku-5-5");
    // The body is the prompt built from the LetterRequest and nothing else:
    // no budget, no WBS flag, no key.
    expect(body.system).toBe(buildLetterPrompt(request).system);
    expect(body.messages).toEqual([
      { role: "user", content: buildLetterPrompt(request).user },
    ]);
    const sent = JSON.stringify(body);
    expect(sent).not.toMatch(/9\.?876/);
    expect(sent).not.toMatch(/WBS|Wohnberechtigung/i);
    expect(sent).not.toContain(KEY);
  });

  it("defaults to Sonnet and answers a failed call with a mapped error", async () => {
    await writeAll({ apiKey: KEY });
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response("{}", { status: 401 })),
    );

    const result = await generateLetter(request, (key) =>
      createClaudeClient(key, { fetch }),
    );

    expect(result).toMatchObject({ kind: "error", code: "invalid_key" });
    expect(JSON.stringify(result)).not.toContain(KEY);
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string) as {
      model: string;
    };
    expect(body.model).toBe("claude-sonnet-5-5");
  });
});
