import { findAttribution } from "./scripts/attribution.ts";

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // No AI co-author trailer or footer (the author's global rules).
        "no-ai-attribution": ({ raw }) => {
          const found = findAttribution(raw ?? "");
          return [found.length === 0, `remove: ${found.join(" | ")}`];
        },
      },
    },
  ],
  rules: { "no-ai-attribution": [2, "always"] },
};
