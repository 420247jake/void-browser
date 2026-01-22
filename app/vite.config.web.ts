import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Vite config for web demo build (no Tauri)
export default defineConfig({
  plugins: [react()],
  base: "./", // Use relative paths for easy hosting anywhere
  build: {
    outDir: "../web-demo-build",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index-web.html"),
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // Mock Tauri imports for web build
      "@tauri-apps/api/core": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
      "@tauri-apps/api/event": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
      "@tauri-apps/api/window": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
      "@tauri-apps/plugin-dialog": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
      "@tauri-apps/plugin-fs": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
      "@tauri-apps/plugin-sql": resolve(__dirname, "./src/lib/web/tauriMock.ts"),
    },
  },
});
