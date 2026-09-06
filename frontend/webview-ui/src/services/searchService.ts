// Search service — the seam where this prototype's mock search will be
// swapped for the real backend call.
//
// Today:   mockSearch()  scores against `generatedSearchEntries` locally.
// Future:  apiSearch()   POSTs to FastAPI's `/api/search` and returns the
//                        same `SearchResult[]` shape, so no component
//                        above this file needs to change.

import { generatedSearchEntries } from "../data/mockData";
import type { SearchResult } from "../data/types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Small set of stopwords so "where is the ... implemented" doesn't
// dilute scoring with near-universal words.
const STOPWORDS = new Set([
  "where", "is", "the", "are", "a", "an", "in", "of", "for", "to",
  "find", "code", "that", "does", "how", "what", "responsible",
  "implemented", "handled", "used", "working", "done", "does",
  "happens", "when", "occurs",
]);

/**
 * mockSearch — placeholder for POST /api/search.
 *
 * Real implementation will eventually be:
 *   CodeBERT(query) -> embedding -> FAISS.search(embedding, top_k)
 *   -> vector ids -> PostgreSQL metadata lookup -> ranked results
 *
 * This mock instead does simple keyword-overlap scoring against tags
 * curated per demo entry, so the ranking still visibly reacts to what
 * the user types, without pretending to run a real model.
 */
export function mockSearch(query: string, topK: number): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryTokens = tokenize(trimmed).filter((t) => !STOPWORDS.has(t));

  const scored = generatedSearchEntries.map((entry) => {
    const haystack = new Set([
      ...entry.tags,
      ...tokenize(entry.name),
      ...tokenize(entry.file),
      ...(entry.className ? tokenize(entry.className) : []),
    ]);

    let overlap = 0;
    for (const token of queryTokens) {
      if (haystack.has(token)) overlap += 1;
      else {
        // partial/substring credit, e.g. "auth" matching "authentication"
        for (const h of haystack) {
          if (h.includes(token) || token.includes(h)) {
            overlap += 0.5;
            break;
          }
        }
      }
    }

    const denom = Math.max(queryTokens.length, 1);
    const overlapRatio = Math.min(overlap / denom, 1);

    // Blend the curated base score with how well this query matched,
    // so a strong match lands near baseScore and a weak/unrelated
    // query still produces a plausible (lower) similarity number
    // rather than 0%, similar to how real vector search always
    // returns *something*, just with lower confidence.
    const similarity =
      overlapRatio > 0
        ? entry.baseScore * (0.55 + 0.45 * overlapRatio)
        : 35 + hashTo(entry.id + trimmed, 20); // 35-55% "weak match" band

    return { entry, similarity, overlapRatio };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK).map(({ entry, similarity }) => ({
    id: entry.id,
    similarity: Math.round(similarity * 100) / 100,
    name: entry.name,
    className: entry.className,
    file: entry.file,
    startLine: entry.startLine,
    endLine: entry.endLine,
    code: entry.code,
  }));
}

/** Deterministic pseudo-random offset in [0, range) from a string seed. */
function hashTo(seed: string, range: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % range;
}

/**
 * apiSearch — TODO: implement once the FastAPI backend exists.
 *
 * Intended contract (see project README "Future backend architecture"):
 *
 *   POST /api/search
 *   { "query": string, "workspace_id": string, "top_k": number }
 *   -> { "results": SearchResult[] }
 *
 * Left as a stub (not called anywhere yet) so the mock/real boundary
 * stays explicit and nobody mistakes mockSearch() for a working model.
 */
export async function apiSearch(
  _query: string,
  _workspaceId: string,
  _topK: number
): Promise<SearchResult[]> {
  throw new Error(
    "apiSearch() is not implemented yet — this milestone (Evaluation 2) " +
      "only implements the GUI. Backend integration (FastAPI + CodeBERT " +
      "+ FAISS) is planned for a later milestone."
  );
}
