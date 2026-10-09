import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The bundle is written straight into the extension folder
// (frontend/extension/webview) so it ships inside the .vsix package.
// VS Code webviews load assets via webview.asWebviewUri(), so the bundle
// uses relative URLs (`base: "./"`) and fixed, unhashed file names that
// SidebarProvider.ts references directly (main.js / main.css).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../extension/webview",
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
