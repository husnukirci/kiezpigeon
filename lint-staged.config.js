export default {
  "*.{ts,tsx,js}": ["prettier --write", "eslint"],
  "*.css": ["prettier --write", "stylelint"],
  "*.{md,json,yml,html}": "prettier --write",
};
