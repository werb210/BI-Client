import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  plugins: [react(), VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32x32.png"],
      manifest: {
        name: "Boreal Risk Management",
        short_name: "Boreal Risk",
        description: "Personal Guarantee Insurance applications and status.",
        theme_color: "#0b1f3a",
        background_color: "#0b1f3a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      ...(mode === "test" ? Object.fromEntries([
        "@capacitor/core", "@capacitor/preferences", "@aparajita/capacitor-secure-storage",
        "@capacitor/app", "@capacitor/keyboard", "@capacitor/status-bar",
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
