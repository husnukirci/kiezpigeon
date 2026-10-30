// Typed messages between the side panel, the service worker and content
// scripts (ADR 6, ADR 8). Each message type names its request and its
// response.
import { browser } from "wxt/browser";
import type { ClaudeErrorCode } from "../claude/claude";
import type { FillReport, FillStep } from "../fill/fill";
import type { FormField, LetterRequest, Listing } from "../rules/types";
import type { LetterDraft } from "../rules/writeLetter";

export type ListingResult =
  | { kind: "listing"; siteName: string; listing: Listing }
  | { kind: "not_listing" };

/** `no_form` until the user opens the site's contact form. */
export type ContactFormResult =
  { kind: "form"; fields: FormField[] } | { kind: "no_form" };

/** `changed` when the form is no longer the one the user saw; nothing filled. */
export type FillResult =
  | { kind: "filled"; report: FillReport }
  | { kind: "changed" }
  | { kind: "no_form" };

export type LetterResult =
  | { kind: "letter"; draft: LetterDraft }
  | { kind: "error"; code: ClaudeErrorCode; message: string };

interface Messages {
  ping: { request: { type: "ping" }; response: { type: "pong" } };
  getListing: { request: { type: "getListing" }; response: ListingResult };
  getContactForm: {
    request: { type: "getContactForm" };
    response: ContactFormResult;
  };
  /**
   * Panel to content script, on the user's click only. Never submits.
   * `formKeys` are the keys of the form as the panel last read it.
   */
  fillForm: {
    request: { type: "fillForm"; steps: FillStep[]; formKeys: string[] };
    response: FillResult;
  };
  /** Panel to service worker: the only way a letter is requested. */
  generateLetter: {
    request: { type: "generateLetter"; request: LetterRequest };
    response: LetterResult;
  };
}

export type MessageType = keyof Messages;
export type Message = Messages[MessageType]["request"];
export type ResponseTo<T extends MessageType> = Messages[T]["response"];

export type Handlers = {
  [T in MessageType]?: (
    message: Messages[T]["request"],
  ) => ResponseTo<T> | Promise<ResponseTo<T>>;
};

/** What actually crosses the channel, so a failed handler rejects send(). */
type Envelope = { ok: true; value: unknown } | { ok: false; error: string };

const TYPES: readonly string[] = [
  "ping",
  "getListing",
  "getContactForm",
  "fillForm",
  "generateLetter",
] satisfies MessageType[];

export function isMessage(value: unknown): value is Message {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    TYPES.includes(value.type)
  );
}

/**
 * Sends to a tab's content script when given a tab id, otherwise to the
 * extension's own pages and service worker. Rejects when nobody answers,
 * e.g. a tab without a content script.
 */
export async function send<M extends Message>(
  message: M,
  tabId?: number,
): Promise<ResponseTo<M["type"]>> {
  const answer: unknown =
    tabId === undefined
      ? await browser.runtime.sendMessage(message)
      : await browser.tabs.sendMessage(tabId, message);
  // The answer comes from this extension's own handle() below.
  const envelope = answer as Envelope | undefined;
  if (!envelope) throw new Error(`No answer to ${message.type}`);
  if (!envelope.ok) throw new Error(envelope.error);
  return envelope.value as ResponseTo<M["type"]>;
}

/**
 * Answers the message types it has a handler for and stays silent on the
 * rest, so another listener in the same context can answer them. Returns
 * a function that stops listening.
 */
export function handle(handlers: Handlers): () => void {
  const listener = (
    message: unknown,
    _sender: unknown,
    sendResponse: (envelope: Envelope) => void,
  ): true | undefined => {
    if (!isMessage(message)) return undefined;
    const handler = handlers[message.type] as
      ((message: Message) => unknown) | undefined;
    if (!handler) return undefined;
    // Inside a promise so a handler that throws still answers.
    new Promise((resolve) => {
      resolve(handler(message));
    }).then(
      (value: unknown) => {
        sendResponse({ ok: true, value });
      },
      (error: unknown) => {
        sendResponse({ ok: false, error: String(error) });
      },
    );
    // Keeps the channel open for the asynchronous answer.
    return true;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => {
    browser.runtime.onMessage.removeListener(listener);
  };
}
