// End-to-end runs against the built extension (ADR 5). `npm run test:e2e`
// builds first; each spec loads `.output/chrome-mv3/` into Chromium.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
});
