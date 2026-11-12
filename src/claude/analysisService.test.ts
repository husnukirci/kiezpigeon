import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { createAnalysisRequest } from "../rules/analysisRequest";
import { resetForTests, writeAll } from "../storage/storage";
import { createClaudeClient, type ClaudeClient } from "./claude";
import { ANALYSIS_ERROR_MESSAGES, analyseListing } from "./analysisService";

const KEY = "FAKE-KEY-0123456789";
const request = createAnalysisRequest(
  coupleWithDog,
  kreuzbergListing,
  "Helle Wohnung am Kanal.",
);

const answer = "## What this is\nA flat.\n\n## Price\nFair.";

beforeEach(() => {
  fakeBrowser.reset();
  resetForTests();
});

describe("analyseListing", () => {
  it("answers no_key without calling Claude when no key is stored", async () => {
    const createClient = vi.fn(createClaudeClient);
    expect(await analyseListing(request, createClient)).toEqual({
      kind: "error",
      code: "no_key",
      message: ANALYSIS_ERROR_MESSAGES.no_key,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the sections and always asks Opus 5.5, whatever the setting", async () => {
    await writeAll({ apiKey: KEY, settings: { model: "claude-haiku-5-5" } });
    const generate = vi.fn<ClaudeClient["generate"]>(() =>
      Promise.resolve(answer),
    );

    const result = await analyseListing(request, () => ({ generate }));

    expect(result).toEqual({
      kind: "analysis",
      sections: [
        { heading: "What this is", text: "A flat." },
        { heading: "Price", text: "Fair." },
      ],
    });
    expect(generate.mock.calls[0]?.[1]).toEqual({ model: "claude-opus-5-5" });
  });

  it("answers a model the key cannot use with the analysis message", async () => {
    await writeAll({ apiKey: KEY });
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "permission_error",
              message: "Your key has no access to this model.",
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await analyseListing(request, (key) =>
      createClaudeClient(key, { fetch }),
    );

    expect(result).toEqual({
      kind: "error",
      code: "model_unavailable",
      message: ANALYSIS_ERROR_MESSAGES.model_unavailable,
    });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("no message names the provider", () => {
    for (const message of Object.values(ANALYSIS_ERROR_MESSAGES)) {
      expect(message).not.toMatch(/\b(claude|anthropic|ai|model|assistant)\b/i);
      expect(message).not.toContain("—");
    }
  });
});
