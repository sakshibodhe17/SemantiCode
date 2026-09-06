// Centralized mock data for the SemantiCode webview UI.
//
// This is the ONLY place demo/placeholder data should live for the
// developer-facing (non-admin) screens. Nothing here reflects a real
// running AI system — see `searchService.ts` for the clearly-labeled
// boundary between `mockSearch()` (used today) and `apiSearch()`
// (the TODO stub for the real FastAPI endpoint).
//
// Search-result content (function names, file paths, line numbers,
// and code snippets) is generated from the REAL files in `demo-project/`
// by `scripts/gen_mockdata.py` — see `searchEntries.generated.ts`.
// That means "Open in Editor" in this prototype opens a real file at a
// real line, even though the ranking is a mock similarity score.

import { generatedSearchEntries } from "./searchEntries.generated";

import type {
  HistoryEntry,
  IndexingStepState,
  IndexStats,
  SemantiCodeSettings,
  WorkspaceInfo,
} from "./types";

export const WORKSPACE_NAME = "demo-project";

export const mockWorkspace: WorkspaceInfo = {
  name: WORKSPACE_NAME,
  path: "C:/MCA/Sem III (Mini Project)/semanticode/demo-project",
  primaryLanguage: "Python",
  status: "indexed",
  lastIndexedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),

  stats: {
    files: 248,
    functions: 1842,
    classes: 312,
    chunks: 2104,
    indexingTimeSeconds: 12.8,
  },
};

// Displayed on the Welcome screen before indexing has ever run.
export const mockPreIndexStats: Pick<IndexStats, "files"> = {
  files: 248,
};

export const suggestedQueries: string[] = [
  "Where is user authentication implemented?",
  "Where is the database connection created?",
  "Find code responsible for file uploads",
  "Where is the JWT token generated?",
];

export const indexingStepsTemplate: IndexingStepState[] = [
  {
    id: "detect",
    label: "Workspace detected",
    status: "pending",
  },
  {
    id: "scan",
    label: "Scanning source files",
    status: "pending",
  },
  {
    id: "parse",
    label: "Parsing code (Tree-sitter)",
    status: "pending",
  },
  {
    id: "extract",
    label: "Extracting functions & classes",
    status: "pending",
  },
  {
    id: "chunk",
    label: "Creating code chunks",
    status: "pending",
  },
  {
    id: "embed",
    label: "Generating embeddings (CodeBERT)",
    status: "pending",
  },
  {
    id: "faiss",
    label: "Building FAISS index",
    status: "pending",
  },
  {
    id: "ready",
    label: "Ready",
    status: "pending",
  },
];

export const defaultSettings: SemantiCodeSettings = {
  embeddingModel: "CodeBERT",
  modelVersion: "microsoft/codebert-base",
  vectorSearchEngine: "FAISS",
  similarityMetric: "Cosine Similarity",
  topK: 10,

  supportedLanguages: {
    Python: true,
    JavaScript: true,
    TypeScript: true,
    Java: true,
    C: true,
    "C++": true,
    Go: true,
  },
};

export const mockSearchHistory: HistoryEntry[] = [
  {
    id: "h1",
    query: "Where is JWT authentication handled?",
    workspace: WORKSPACE_NAME,
    timestamp: new Date(
      new Date().setHours(23, 42, 0, 0),
    ).toISOString(),
    resultCount: 4,
  },

  {
    id: "h2",
    query: "Where is the database connection created?",
    workspace: WORKSPACE_NAME,
    timestamp: new Date(
      new Date().setHours(23, 35, 0, 0),
    ).toISOString(),
    resultCount: 2,
  },

  {
    id: "h3",
    query: "Find file upload validation",
    workspace: WORKSPACE_NAME,
    timestamp: new Date(
      Date.now() - 1000 * 60 * 60 * 26,
    ).toISOString(),
    resultCount: 2,
  },
];

export { generatedSearchEntries };