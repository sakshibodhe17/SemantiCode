// Real workspace detection: name, absolute path, and a lightweight
// primary-language guess are genuinely read from the open VS Code
// workspace. File/function/class/chunk counts stay as clearly-labeled
// mock numbers — matching the project brief's example statistics —
// because computing them for real requires the Tree-sitter + CodeBERT
// + FAISS pipeline planned for later milestones (see project README).

import * as vscode from "vscode";
import type { HostWorkspaceInfo } from "../types";

const EXT_TO_LANGUAGE: Record<string, string> = {
  py: "Python",
  js: "JavaScript",
  jsx: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  java: "Java",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  hpp: "C++",
  go: "Go",
};

// Mirrors the example statistics in the Evaluation 2 brief. Stands in
// for what a real indexing run would eventually report.
export const mockIndexStats = {
  files: 248,
  functions: 1842,
  classes: 312,
  chunks: 2104,
  indexingTimeSeconds: 12.8,
};

async function detectPrimaryLanguage(): Promise<string> {
  try {
    const files = await vscode.workspace.findFiles(
      "**/*.{py,js,jsx,ts,tsx,java,c,cc,cpp,h,hpp,go}",
      "**/{node_modules,dist,out,.git,__pycache__,.venv}/**",
      200
    );
    const counts = new Map<string, number>();
    for (const uri of files) {
      const ext = uri.path.split(".").pop()?.toLowerCase() ?? "";
      const lang = EXT_TO_LANGUAGE[ext];
      if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        best = lang;
      }
    }
    return best ?? "Python";
  } catch {
    return "Python";
  }
}

export async function detectWorkspace(): Promise<HostWorkspaceInfo | null> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return null;

  const primaryLanguage = await detectPrimaryLanguage();

  return {
    name: folder.name,
    path: folder.uri.fsPath,
    primaryLanguage,
    status: "not-indexed",
    lastIndexedAt: null,
    stats: { files: 0, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0 },
  };
}
