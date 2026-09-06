// Typed postMessage protocol between this webview and extension.ts.
//
// This is the boundary that stays real even though search results are
// mocked: opening a file, reading/writing VS Code settings, and
// persisting search history all go through the actual extension host
// APIs (vscode.window.showTextDocument, vscode.workspace.getConfiguration,
// context.globalState) rather than being faked in the webview.
//
// Mirrored in extension/src/panels/SidebarProvider.ts — keep both in
// sync if you add a message type.

import type { HistoryEntry, SemantiCodeSettings, WorkspaceInfo } from "./data/types";

// ---- Webview -> Extension host ----
export type OutboundMessage =
  | { type: "ready" }
  | { type: "openFile"; file: string; startLine: number; endLine: number }
  | { type: "searchExecuted"; query: string; resultCount: number }
  | { type: "reindexWorkspace" }
  | { type: "clearIndex" }
  | { type: "updateSetting"; key: keyof SemantiCodeSettings; value: unknown }
  | { type: "clearHistory" };

// ---- Extension host -> Webview ----
export type InboundMessage =
  | { type: "workspaceInfo"; workspace: WorkspaceInfo }
  | { type: "historyUpdated"; history: HistoryEntry[] }
  | { type: "settingsInitial"; settings: SemantiCodeSettings }
  | { type: "openFileAck"; file: string; ok: boolean };
