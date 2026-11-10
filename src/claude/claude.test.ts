import { describe, expect, it, vi } from "vitest";
import {
  coupleWithDog,
  kreuzbergListing,
} from "../../test-support/sample-profiles";
import { buildLetterPrompt, createLetterRequest } from "../rules/letterPrompt";
import {
  ClaudeError,
  ERROR_MESSAGES,
  createClaudeClient,
  type ClaudeErrorCode,
} from "./claude";

const KEY = "FAKE-KEY-0123456789";

const prompt = buildLetterPrompt(
  createLetterRequest(coupleWithDog, kreuzbergListing, {
    tone: "warm",
    features: ["Balkon"],
  }),
);

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "Sehr geehrte Frau Weber," },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    ...overrides,
  };
}

function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

async function failure(fetch: typeof globalThis.fetch): Promise<unknown> {
  const client = createClaudeClient(KEY, { fetch });
  return client.generate(prompt, { model: "claude-sonnet-5-5" }).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("createClaudeClient", () => {
  it("posts the prompt to the Messages API with the key and the browser header", async () => {
    const fetch = respond(200, message());
    const client = createClaudeClient(KEY, { fetch });

    const text = await client.generate(prompt, { model: "claude-haiku-5-5" });

    expect(text).toBe("Sehr geehrte Frau Weber,");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    // SDK 1.x sends the key as a bearer token at API version 2026-10-21;
    // the Phase 4 probe saw the API accept exactly these from a worker.
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(headers.get("anthropic-version")).toBe("2026-10-21");
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe(
      "true",
    );
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "max_tokens",
      "messages",
      "model",
      "output_config",
      "system",
    ]);
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.system).toBe(prompt.system);
    expect(body.messages).toEqual([{ role: "user", content: prompt.user }]);
  });

  it.each<[number, ClaudeErrorCode]>([
    [401, "invalid_key"],
    [403, "invalid_key"],
    [429, "rate_limited"],
    [529, "unavailable"],
    [400, "failed"],
  ])(
    "maps HTTP %i to %s with our own message, never the API's or the key",
    async (status, code) => {
      const error = await failure(
        respond(status, {
          type: "error",
          error: { type: "some_error", message: `bad key ${KEY}` },
        }),
      );
      expect(error).toBeInstanceOf(ClaudeError);
      expect((error as ClaudeError).code).toBe(code);
      expect((error as ClaudeError).message).toBe(ERROR_MESSAGES[code]);
      expect(String(error)).not.toContain(KEY);
      expect(JSON.stringify(error)).not.toContain(KEY);
    },
  );

  it("maps a failed connection to network", async () => {
    const error = await failure(
      vi.fn<typeof fetch>(() =>
        Promise.reject(new TypeError("Failed to fetch")),
      ),
    );
    expect((error as ClaudeError).code).toBe("network");
  });

  it("treats a refusal and an empty or cut-off answer as errors", async () => {
    const refused = await failure(
      respond(200, message({ stop_reason: "refusal", content: [] })),
    );
    expect((refused as ClaudeError).code).toBe("refused");
    const cut = await failure(
      respond(200, message({ stop_reason: "max_tokens" })),
    );
    expect((cut as ClaudeError).code).toBe("cut_off");
  });

  it.each<[number, string, ClaudeErrorCode]>([
    [
      400,
      "Your credit balance is too low to access the Anthropic API.",
      "no_credit",
    ],
    [400, "max_tokens: must be at least 1", "failed"],
    [404, "model: claude-nope", "model_unavailable"],
    [
      403,
      "Your API key does not have access to model: claude-nope",
      "model_unavailable",
    ],
    [403, "Request not allowed", "invalid_key"],
  ])("maps a %d saying %s to %s", async (status, text, code) => {
    const error = await failure(
      respond(status, {
        type: "error",
        error: { type: "invalid_request_error", message: text },
      }),
    );
    expect(error).toMatchObject({ code, message: ERROR_MESSAGES[code] });
  });

  it.each<[number, string]>([
    [402, "Payment required."],
    [400, "Please add funds to continue."],
  ])("maps a %d billing_error saying %s to no_credit", async (status, text) => {
    const error = await failure(
      respond(status, {
        type: "error",
        error: { type: "billing_error", message: text },
      }),
    );
    expect(error).toMatchObject({
      code: "no_credit",
      message: ERROR_MESSAGES.no_credit,
    });
  });

  it("judges a 403 by the API's message, not by other parts of its body", async () => {
    const error = await failure(
      respond(403, {
        type: "error",
        model: "claude-sonnet-5-5",
        error: { type: "permission_error", message: "Request not allowed" },
      }),
    );
    expect(error).toMatchObject({
      code: "invalid_key",
      message: ERROR_MESSAGES.invalid_key,
    });
  });

  it("no longer blames credit for an unknown failure", () => {
    expect(ERROR_MESSAGES.failed).not.toMatch(/credit/i);
  });

  it("logs nothing, not even on a failure", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (level) => vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    await failure(respond(401, { type: "error", error: { type: "x" } }));
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
