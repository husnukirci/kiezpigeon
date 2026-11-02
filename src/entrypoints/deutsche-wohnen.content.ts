import { defineContentScript } from "wxt/utils/define-content-script";
import { deutscheWohnen } from "../adapters/deutsche-wohnen/deutscheWohnen";
import { answerAs } from "../messaging/siteScript";

// Answers the side panel on Deutsche Wohnen listing pages (ADR 8).
export default defineContentScript({
  matches: ["https://www.deutsche-wohnen.com/mieten/mietangebote/*"],
  main() {
    answerAs(deutscheWohnen);
  },
});
