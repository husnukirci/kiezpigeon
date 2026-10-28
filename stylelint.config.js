// Stylelint: styles use design tokens only (ADR 7). Colours, type sizes,
// spacing and radii must come from var(--…); hex and named colours fail.
// The generated tokens.css is the one file allowed raw values.
const TOKEN_ONLY_PROPERTIES = [
  "/color$/",
  "background",
  "fill",
  "stroke",
  "font-size",
  "line-height",
  "/^padding/",
  "/^margin/",
  "gap",
  "row-gap",
  "column-gap",
  "/radius$/",
];

export default {
  extends: ["stylelint-config-standard", "stylelint-config-css-modules"],
  ignoreFiles: ["src/styles/tokens.css", ".output/**", ".wxt/**"],
  plugins: ["stylelint-declaration-strict-value"],
  rules: {
    "color-no-hex": true,
    "color-named": "never",
    "scale-unlimited/declaration-strict-value": [
      TOKEN_ONLY_PROPERTIES,
      {
        ignoreValues: [
          "0",
          "none",
          "auto",
          "inherit",
          "initial",
          "unset",
          "transparent",
          "currentcolor",
        ],
        ignoreFunctions: false,
      },
    ],
  },
  overrides: [
    {
      // CSS module class names are read from TypeScript as styles.sunDot.
      files: ["**/*.module.css"],
      rules: {
        "selector-class-pattern": [
          "^[a-z][a-zA-Z0-9]*$",
          { message: "Use camelCase for CSS module classes" },
        ],
      },
    },
  ],
};
