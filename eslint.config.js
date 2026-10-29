// ESLint flat config. The folder boundaries from ADR 6 live here, so a
// wrong import fails `npm run lint` before it reaches review.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const BROWSER_STORAGE = [
  {
    object: "browser",
    property: "storage",
    message: "Only src/storage/ touches extension storage (ADR 3).",
  },
  {
    object: "chrome",
    property: "storage",
    message: "Only src/storage/ touches extension storage (ADR 3).",
  },
];

const ANTHROPIC_HOST = [
  {
    selector: "Literal[value=/api\\.anthropic\\.com/]",
    message: "Only src/claude/ talks to the Claude API (ADR 4).",
  },
  {
    selector: "TemplateElement[value.raw=/api\\.anthropic\\.com/]",
    message: "Only src/claude/ talks to the Claude API (ADR 4).",
  },
];

export default tseslint.config(
  { ignores: [".output/", ".wxt/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["scripts/**/*.ts", "*.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-properties": ["error", ...BROWSER_STORAGE],
      "no-restricted-syntax": ["error", ...ANTHROPIC_HOST],
    },
  },
  {
    files: ["src/storage/**"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["src/claude/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // The rules core is pure: plain data in, plain data out. It imports only
    // its own files and reaches for no browser, DOM, network, clock or
    // randomness (CLAUDE.md "Rules are pure").
    files: ["src/rules/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\./)",
              message:
                "src/rules/ imports only from itself (ADR 6): no packages, no other folders.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "navigator",
          "fetch",
          "chrome",
          "browser",
          "localStorage",
        ].map((name) => ({
          name,
          message: "src/rules/ is pure: pass data in instead.",
        })),
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Pass the time in." },
        { object: "Math", property: "random", message: "Pass randomness in." },
      ],
      "no-restricted-syntax": [
        "error",
        ...ANTHROPIC_HOST,
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Pass the time in.",
        },
      ],
    },
  },
  {
    // Rules tests also need the test runner and the invented sample
    // profiles; nothing else crosses the boundary, tests included.
    files: ["src/rules/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!\\./|vitest$|\\.\\./\\.\\./test-support/)",
              message:
                "src/rules/ tests import only rules, vitest and test-support (ADR 6).",
            },
          ],
        },
      ],
    },
  },
  {
    // Adapters and fill read and write a page; they may use the rules core
    // but never the UI, storage or the Claude client (ADR 6).
    files: ["src/adapters/**", "src/fill/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/ui",
                "**/ui/**",
                "**/storage",
                "**/storage/**",
                "**/claude",
                "**/claude/**",
              ],
              message:
                "src/adapters/ and src/fill/ may import src/rules/, never ui, storage or claude (ADR 6).",
            },
            {
              group: ["react", "react-dom", "react/*", "react-dom/*"],
              message: "Adapters and fill render no UI (ADR 2).",
            },
          ],
        },
      ],
    },
  },
  {
    // Their tests may render a small React form as a stand-in for a
    // framework-driven page (the ADR 11 probe); the folder rule still holds.
    files: ["src/adapters/**/*.test.{ts,tsx}", "src/fill/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/ui",
                "**/ui/**",
                "**/storage",
                "**/storage/**",
                "**/claude",
                "**/claude/**",
              ],
              message:
                "src/adapters/ and src/fill/ may import src/rules/, never ui, storage or claude (ADR 6).",
            },
          ],
        },
      ],
    },
  },
);
