// Minimal type definitions the extension host needs. Mirrors the
// richer versions in webview-ui/src/data/types.ts — only the fields
// the host actually touches are duplicated here on purpose, so this
// file doesn't silently drift out of sync with unused fields.

export interface HostWorkspaceInfo {
  name: string;
  path: string;
  primaryLanguage: string;
  status: "not-indexed" | "indexing" | "indexed";
  stats: {
    files: number;
    functions: number;
    classes: number;
    chunks: number;
    indexingTimeSeconds: number;
  };
  lastIndexedAt: string | null;
}

export interface HostHistoryEntry {
  id: string;
  query: string;
  workspace: string;
  timestamp: string;
  resultCount: number;
}

export interface HostSettings {
  embeddingModel: string;
  modelVersion: string;
  vectorSearchEngine: string;
  similarityMetric: string;
  topK: number;
  supportedLanguages: Record<string, boolean>;
}
