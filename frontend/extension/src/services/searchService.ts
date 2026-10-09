// One entry point for searching, independent of which engine is active.
//
//   engine = "local"   (default) -> in-process BM25F index (IndexService)
//   engine = "backend"            -> the project's FastAPI server
//                                    (POST /api/index, POST /api/search)
//
// Both paths return the same SearchResult shape, so the UI never needs
// to know which engine produced the results.

import * as vscode from "vscode";
import type { RankedResult } from "../engine/searchIndex";
import type { SearchResult } from "../shared/protocol";
import { IndexService } from "./indexService";
import { readSettings } from "./settingsService";

export function toSearchResult(r: RankedResult): SearchResult {
  const c = r.chunk;
  return {
    id: c.id,
    similarity: r.relevance,
    name: c.name,
    className: c.className,
    kind: c.kind,
    language: c.language,
    file: c.file,
    startLine: c.startLine,
    endLine: c.endLine,
    code: c.code,
    matched: r.matched,
  };
}

function workspaceId(): string {
  return vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = readSettings().backendUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot reach the SemantiCode backend at ${base}. Start it with “python -m uvicorn backend.main:app --port 8000” or switch the engine back to “local”.`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Backend error ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export async function backendIndex(): Promise<{ files_indexed: number; chunks_indexed: number }> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error("Open a folder first.");
  return post("/api/index", { workspace_id: workspaceId(), path: folder.uri.fsPath });
}

interface BackendResult {
  id: string;
  similarity: number;
  name: string;
  className: string | null;
  kind?: string;
  language?: string;
  file: string;
  startLine: number;
  endLine: number;
  code: string | string[];
  matched?: { term: string; via: "exact" | "concept" | "prefix" }[];
}

export async function runSearch(
  indexService: IndexService,
  query: string,
  topK: number,
  opts: { expand?: boolean } = {}
): Promise<SearchResult[]> {
  const settings = readSettings();
  if (settings.engine === "backend") {
    const data = await post<{ results: BackendResult[] }>("/api/search", {
      workspace_id: workspaceId(),
      query,
      top_k: topK,
    });
    return data.results.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      name: r.name,
      className: r.className,
      kind: r.kind ?? "function",
      language: r.language ?? "",
      file: r.file,
      startLine: r.startLine,
      endLine: r.endLine,
      code: Array.isArray(r.code) ? r.code : r.code.split(/\r?\n/),
      matched: r.matched ?? [],
    }));
  }
  const expand = opts.expand ?? settings.queryExpansion;
  return (await indexService.search(query, topK, expand)).map(toSearchResult);
}
