import { defineContentScript } from "wxt/utils/define-content-script";
import { vonovia } from "../adapters/vonovia/vonovia";
import { answerAs } from "../messaging/siteScript";

// Answers the side panel on Vonovia listing pages (ADR 8).
export default defineContentScript({
  matches: ["https://www.vonovia.de/zuhause-finden/immobilien/*"],
  main() {
    answerAs(vonovia);
  },
});
