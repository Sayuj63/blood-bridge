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
  plugins: [react(), tailwindcss(), cloudflare()],
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
