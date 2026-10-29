import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { generateLetter } from "../claude/letterService";
import { handle } from "../messaging/messaging";
import { openPanelOn } from "../messaging/panel";

export default defineBackground(() => {
  // The panel belongs to the tab it was opened on (ADR 8): off everywhere
  // by default, switched on for one tab by a click on the icon.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  void browser.sidePanel.setOptions({ enabled: false });
  browser.action.onClicked.addListener(openPanelOn);
  // Letters are written here only, so the API key never leaves the worker.
  handle({
    generateLetter: (message) => generateLetter(message.request),
  });
});
