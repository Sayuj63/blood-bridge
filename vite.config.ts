import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Keep heavy map and chart libraries in their own cacheable chunks. */
const VENDOR_CHUNKS: Record<string, string> = {
  "maplibre-gl": "map",
  "@deck.gl": "map",
  "@luma.gl": "map",
  recharts: "charts",
};

export default defineConfig({
  // Remote bindings (Workers AI) need a Cloudflare login. Off by default so anyone can run
  // `pnpm dev` locally (the AI brief and translations fall back to templates); CF_REMOTE=1 to enable.
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: process.env.CF_REMOTE === "1" })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          return Object.entries(VENDOR_CHUNKS).find(([pkg]) => id.includes(`/node_modules/${pkg}`))?.[1];
        },
      },
    },
  },
});
