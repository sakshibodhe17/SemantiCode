// Bridge between the React app and the VS Code extension host.
//
// Inside a real VS Code webview, `acquireVsCodeApi()` is injected by
// the host and is the only way to talk back to extension.ts (webviews
// are sandboxed — no direct Node/filesystem access). Outside VS Code
// (e.g. `npm run dev` in a normal browser, or the Playwright checks
// used to test this UI) that function doesn't exist, so we fall back
// to a small in-memory shim. This lets the exact same React app run
// standalone for design review/testing, and for real inside the
// extension — no code forks required.

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

function createStandaloneShim(): VsCodeApi {
  let state: unknown = undefined;
  return {
    postMessage(message: unknown) {
      // eslint-disable-next-line no-console
      console.log("[standalone-mode] postMessage (no extension host attached):", message);
    },
    getState() {
      return state;
    },
    setState(next: unknown) {
      state = next;
    },
  };
}

let cached: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (cached) return cached;
  cached = window.acquireVsCodeApi
    ? window.acquireVsCodeApi()
    : createStandaloneShim();
  return cached;
}

export const isInsideVsCode = typeof window.acquireVsCodeApi === "function";
