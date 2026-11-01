import { defineContentScript } from "wxt/utils/define-content-script";
import { immoscout24 } from "../adapters/immoscout24/immoscout24";
import { answerAs } from "../messaging/siteScript";

// Answers the side panel on ImmoScout24 exposé pages (ADR 8).
export default defineContentScript({
  matches: [
    "https://www.immobilienscout24.de/expose/*",
    "https://www.immobilienscout24.de/en/expose/*",
  ],
  main() {
    answerAs(immoscout24);
  },
});
