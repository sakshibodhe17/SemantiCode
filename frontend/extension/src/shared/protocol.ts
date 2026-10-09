// Message protocol between the extension host and the React webview.
//
// The webview is a sandboxed browser page (no Node, no file system), so
// every real action — indexing, searching, opening files, reading
// settings — is requested by a message and performed here in the
// extension host. webview-ui/src/messaging.ts mirrors these types; keep
// both files in sync when adding a message.

export type IndexStatus = "not-indexed" | "indexing" | "indexed" | "error";

export interface WorkspaceStats {
  files: number;
  functions: number;
  classes: number;
  chunks: number;
  indexingTimeSeconds: number;
  languages: Record<string, number>;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  primaryLanguage: string;
  status: IndexStatus;
  stats: WorkspaceStats;
  lastIndexedAt: string | null;
  engine: "local" | "backend";
}

export interface MatchedTerm {
  term: string;
  via: "exact" | "concept" | "prefix";
}

export interface SearchResult {
  id: string;
  similarity: number; // 0-100 relevance shown to the user
  name: string;
  className: string | null;
  kind: string;
  language: string;
  file: string;
  startLine: number;
  endLine: number;
  code: string[];
  matched: MatchedTerm[];
}

export interface HistoryEntry {
  id: string;
  query: string;
  workspace: string;
  timestamp: string;
  resultCount: number;
}

export interface Settings {
  engine: "local" | "backend";
  backendUrl: string;
  rankingModel: string;
  topK: number;
  queryExpansion: boolean;
  autoIndexOnSave: boolean;
  supportedLanguages: Record<string, boolean>;
}

export interface IndexProgress {
  phase: "detect" | "scan" | "parse" | "build" | "save" | "done";
  current: number;
  total: number;
  message: string;
}

// ---- Webview -> Extension host
export type WebviewToHost =
  | { type: "ready" }
  | { type: "indexWorkspace" }
  | { type: "clearIndex" }
  | { type: "search"; query: string; topK: number; requestId: number }
  | { type: "openFile"; file: string; startLine: number; endLine: number }
  | { type: "updateSetting"; key: keyof Settings; value: unknown }
  | { type: "clearHistory" }
  | { type: "openSettingsJson" };

// ---- Extension host -> Webview
export type HostToWebview =
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
