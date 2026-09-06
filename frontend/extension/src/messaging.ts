// Mirrors webview-ui/src/messaging.ts. Keep both in sync when adding a
// message type — see the note there for why this isn't a shared import
// (extension.ts and the webview React app are two separate TS/bundler
// projects: Node/CommonJS vs. browser/ESM).

export type OutboundFromWebview =
  | { type: "ready" }
  | { type: "openFile"; file: string; startLine: number; endLine: number }
  | { type: "searchExecuted"; query: string; resultCount: number }
  | { type: "reindexWorkspace" }
  | { type: "clearIndex" }
  | { type: "updateSetting"; key: string; value: unknown }
  | { type: "clearHistory" };

export type InboundToWebview =
  | { type: "workspaceInfo"; workspace: import("./types").HostWorkspaceInfo }
  | { type: "historyUpdated"; history: import("./types").HostHistoryEntry[] }
  | { type: "settingsInitial"; settings: import("./types").HostSettings }
  | { type: "openFileAck"; file: string; ok: boolean };
