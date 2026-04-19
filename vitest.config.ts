import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import electron from "vite-plugin-electron/simple";
import path from "path";

export default defineConfig({
  plugins: [
    react(),

    // ✅ CORRECT ELECTRON CONFIG
    electron({
      main: {
        entry: "electron.js",
      },
      preload: {
        input: "preload.js",
      },
      renderer: {}
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },

  build: {
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },

    emptyOutDir: true,
  },
});