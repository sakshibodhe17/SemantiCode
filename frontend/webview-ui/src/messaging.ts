// Typed postMessage protocol between this webview and the extension host.
// Mirrors frontend/extension/src/shared/protocol.ts — keep both in sync.

import type {
  HistoryEntry,
  IndexProgress,
  SearchResult,
  Settings,
  WorkspaceInfo,
} from "./data/types";

// ---- Webview -> Extension host
export type OutboundMessage =
  | { type: "ready" }
  | { type: "indexWorkspace" }
  | { type: "clearIndex" }
  | { type: "search"; query: string; topK: number; requestId: number }
  | { type: "openFile"; file: string; startLine: number; endLine: number }
  | { type: "updateSetting"; key: keyof Settings; value: unknown }
  | { type: "clearHistory" }
  | { type: "openSettingsJson" };

// ---- Extension host -> Webview
export type InboundMessage =
  | { type: "workspaceInfo"; workspace: WorkspaceInfo }
  | { type: "indexProgress"; progress: IndexProgress }
  | { type: "indexError"; message: string }
  | { type: "searchResults"; requestId: number; query: string; results: SearchResult[]; elapsedMs: number }
  | { type: "searchError"; requestId: number; message: string }
  | { type: "externalSearch"; query: string; label: string; results: SearchResult[]; elapsedMs: number }
  | { type: "historyUpdated"; history: HistoryEntry[] }
  | { type: "settings"; settings: Settings }
  | { type: "openFileAck"; file: string; ok: boolean }
  | { type: "focusSearch" };
