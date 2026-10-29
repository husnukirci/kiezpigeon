import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  // Explicit imports everywhere, so each file shows where its names come from.
  imports: false,
  manifest: {
    name: "Kiezpigeon",
    description:
      "Writes your Berlin flat application and fills the contact form. You review and press Send yourself.",
    permissions: ["sidePanel", "storage"],
    // The letter call from the service worker (ADR 4); nothing else.
    host_permissions: ["https://api.anthropic.com/*"],
    action: {
      default_title: "Open Kiezpigeon",
    },
  },
});
