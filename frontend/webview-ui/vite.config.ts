import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VS Code webviews load assets via a webview.asWebviewUri() rewritten
// path, so the bundle must use relative asset URLs (`base: "./"`) and
// predictable, unhashed output filenames — the extension host
// references `dist/main.js` / `dist/main.css` directly rather than
// parsing a manifest.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "main.css" : "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
  },
});
