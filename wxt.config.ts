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
    // activeTab + scripting: the fallback reads and fills an unknown site's
    // form on the user's click only, with no host permission (ADR 12).
    permissions: ["sidePanel", "storage", "activeTab", "scripting"],
    // The letter call from the service worker (ADR 4); nothing else.
    host_permissions: ["https://api.anthropic.com/*"],
    action: {
      default_title: "Open Kiezpigeon",
    },
  },
});
