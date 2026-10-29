// Typed messages between the side panel, the service worker and content
// scripts (ADR 6, ADR 8). Each message type names its request and its
// response; later phases add getContactForm, fill and generateLetter here.
import { browser } from "wxt/browser";
import type { Listing } from "../rules/types";

export type ListingResult =
  | { kind: "listing"; siteName: string; listing: Listing }
  | { kind: "not_listing" };

interface Messages {
  ping: { request: { type: "ping" }; response: { type: "pong" } };
  getListing: { request: { type: "getListing" }; response: ListingResult };
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

const TYPES: readonly string[] = ["ping", "getListing"] satisfies MessageType[];

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
