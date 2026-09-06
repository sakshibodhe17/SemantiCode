// Shared TypeScript types for the SemantiCode webview UI.
//
// These shapes mirror what the future FastAPI backend is expected to
// return (see docs in the project README, section "Future API"), so
// swapping mockSearch() for a real fetch() call later should not
// require changing any component prop types.

export interface WorkspaceInfo {
  name: string;
  path: string;
  primaryLanguage: string;
  status: "not-indexed" | "indexing" | "indexed";
  stats: IndexStats;
  lastIndexedAt: string | null;
}

export interface IndexStats {
  files: number;
  functions: number;
  classes: number;
  chunks: number;
  indexingTimeSeconds: number;
}

export interface SearchResult {
  id: string;
  similarity: number; // 0-100
  name: string;
  className: string | null;
  file: string;
  startLine: number;
  endLine: number;
  code: string[];
}

export interface HistoryEntry {
  id: string;
  query: string;
  workspace: string;
  timestamp: string; // ISO string
  resultCount: number;
}

export interface IndexingStepState {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
}

export interface SemantiCodeSettings {
  embeddingModel: string;
  modelVersion: string;
  vectorSearchEngine: string;
  similarityMetric: string;
  topK: number;
  supportedLanguages: Record<string, boolean>;
}

export type ScreenId =
  | "welcome"
  | "search"
  | "workspace"
  | "indexing"
  | "history"
  | "settings";
