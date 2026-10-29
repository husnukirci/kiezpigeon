import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { generateLetter } from "../claude/letterService";
import { handle } from "../messaging/messaging";

export default defineBackground(() => {
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Letters are written here only, so the API key never leaves the worker.
  handle({
    generateLetter: (message) => generateLetter(message.request),
  });
});
