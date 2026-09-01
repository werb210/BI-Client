import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      ...(mode === "test" ? Object.fromEntries([
        "@capacitor/core", "@capacitor/preferences", "@capawesome-team/capacitor-secure-preferences",
        "@capacitor/app", "@capacitor/keyboard", "@capacitor/splash-screen", "@capacitor/status-bar",
        "@capacitor/network", "@capacitor/camera", "@capawesome/capacitor-file-picker",
        "@capacitor/push-notifications",
      ].map((name) => [name, fileURLToPath(new URL("./src/test-capacitor-mock.ts", import.meta.url))])) : {}),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
}));
