import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/void-browser/", // For GitHub Pages / Cloudflare deployment
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 3000,
    strictPort: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
