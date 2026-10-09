// Initial UI state before the extension host replies, plus static UI copy.
// No fake statistics live here any more: every number on screen comes from
// the real index built by the extension host.

import type { IndexingStepState, Settings, WorkspaceInfo } from "./types";

export const emptyWorkspace: WorkspaceInfo = {
  name: "…",
  path: "",
  primaryLanguage: "—",
  status: "not-indexed",
  lastIndexedAt: null,
  engine: "local",
  stats: { files: 0, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0, languages: {} },
};

export const suggestedQueries: string[] = [
  "Where is user authentication implemented?",
  "Where is the database connection created?",
  "How are passwords hashed?",
  "Where are API routes defined?",
  "How are errors handled?",
];

export const indexingStepsTemplate: IndexingStepState[] = [
  { id: "detect", label: "Workspace detected", status: "pending" },
  { id: "scan", label: "Scanning source files", status: "pending" },
  { id: "parse", label: "Extracting functions & classes", status: "pending" },
  { id: "build", label: "Building BM25F search index", status: "pending" },
  { id: "save", label: "Saving index for next session", status: "pending" },
  { id: "done", label: "Ready", status: "pending" },
];

export const defaultSettings: Settings = {
  engine: "local",
  backendUrl: "http://127.0.0.1:8000",
  rankingModel: "BM25F + code-aware query expansion (offline)",
  topK: 10,
  queryExpansion: true,
  autoIndexOnSave: true,
  supportedLanguages: {
    Python: true, JavaScript: true, TypeScript: true, Java: true, C: true, "C++": true,
    Go: true, "C#": true, PHP: true, Rust: true, Kotlin: true, Ruby: true,
  },
};
