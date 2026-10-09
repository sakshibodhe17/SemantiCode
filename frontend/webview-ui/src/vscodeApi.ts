// Bridge between the React app and the VS Code extension host.
//
// Inside a VS Code webview, `acquireVsCodeApi()` is injected by the host
// and is the only way to talk to the extension (webviews are sandboxed —
// no Node.js or file-system access). Outside VS Code (npm run dev, UI
// tests) that function does not exist, so messages are routed to a small
// browser-preview host instead (devHost.ts).

import { handleDevMessage } from "./devHost";

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

function createPreviewShim(): VsCodeApi {
  let state: unknown = undefined;
  return {
    postMessage: handleDevMessage,
    getState: () => state,
    setState: (next: unknown) => {
      state = next;
    },
  };
}

let cached: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (cached) return cached;
  cached = window.acquireVsCodeApi ? window.acquireVsCodeApi() : createPreviewShim();
  return cached;
}

export const isInsideVsCode = typeof window.acquireVsCodeApi === "function";
