// Real read/write bridge to VS Code's `semanticode.*` configuration
// (contributed in package.json). Everything here is genuine — no mock
// data — because settings are one of the few pieces of this milestone
// that map cleanly onto an existing, real VS Code API.

import * as vscode from "vscode";
import type { HostSettings } from "../types";

const SECTION = "semanticode";

// Descriptive-only fields (no real config exists yet for these —
// they represent architecture decisions, not user-tunable values).
const DISPLAY_ONLY = {
  embeddingModelLabel: "CodeBERT",
  vectorSearchEngine: "FAISS",
  similarityMetric: "Cosine Similarity",
};

export function readSettings(): HostSettings {
  const config = vscode.workspace.getConfiguration(SECTION);
  const topK = config.get<number>("topK", 10);
  const embeddingModel = config.get<string>("embeddingModel", "microsoft/codebert-base");
  const languages = config.get<string[]>("supportedLanguages", [
    "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "Go",
  ]);

  return {
    embeddingModel: DISPLAY_ONLY.embeddingModelLabel,
    modelVersion: embeddingModel,
    vectorSearchEngine: DISPLAY_ONLY.vectorSearchEngine,
    similarityMetric: DISPLAY_ONLY.similarityMetric,
    topK,
    supportedLanguages: Object.fromEntries(languages.map((l) => [l, true])),
  };
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);

  if (key === "topK" && typeof value === "number") {
    await config.update("topK", value, vscode.ConfigurationTarget.Global);
    return;
  }

  if (key === "supportedLanguages" && value && typeof value === "object") {
    const enabled = Object.entries(value as Record<string, boolean>)
      .filter(([, on]) => on)
      .map(([lang]) => lang);
    await config.update("supportedLanguages", enabled, vscode.ConfigurationTarget.Global);
    return;
  }

  // Other keys (embeddingModel, vectorSearchEngine, similarityMetric)
  // are display-only placeholders for this milestone — nothing to
  // persist yet.
}
