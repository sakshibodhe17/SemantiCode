// Types shared with the extension host. Mirrors frontend/extension/src/shared/protocol.ts
// (the two projects are bundled separately: Node/CommonJS vs. browser/ESM).

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

export type ScreenId = "welcome" | "search" | "workspace" | "indexing" | "history" | "settings";

export interface IndexingStepState {
  id: IndexProgress["phase"];
  label: string;
  status: "pending" | "active" | "done";
}
