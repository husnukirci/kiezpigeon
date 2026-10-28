import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

// Phase 0: proves the content script loads on a listing. It reads nothing
// yet and only answers a ping; the typed message contract arrives in Phase 3.
export default defineContentScript({
  matches: ["https://www.immobilienscout24.de/expose/*"],
  main() {
    browser.runtime.onMessage.addListener((message: unknown) => {
      if (isPing(message)) {
        return Promise.resolve({ type: "pong" });
      }
      return undefined;
    });
  },
});

function isPing(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "ping"
  );
}
