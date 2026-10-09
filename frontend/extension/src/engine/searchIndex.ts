// In-memory inverted index with BM25F ranking + concept expansion.
//
// Pipeline for a query:
//   1. tokenize (identifier splitting, stopwords, stemming)
//   2. expand each term with related code concepts (synonyms.ts), lower weight
//   3. score every candidate chunk with BM25F: the same term counts more
//      when it appears in the symbol name or docstring than deep in the body
//   4. multiply by "coverage" — the share of the user's query concepts the
//      chunk actually covers — so a chunk matching 3 of 3 ideas beats one
//      that repeats a single word many times
//   5. return top-K with an explanation of which terms matched
//
// Everything is deterministic, offline and explainable, and runs in a few
// milliseconds for tens of thousands of chunks.

import type { ChunkKind, CodeChunk } from "./chunker";
import { relatedTerms } from "./synonyms";
import { splitIdentifiers, stem, tokenize } from "./tokenizer";

const K1 = 1.2;
const B = 0.75;
const FIELD_WEIGHTS = { name: 4, className: 2, path: 1.5, doc: 2.5, body: 1 };
const SYNONYM_WEIGHT = 0.4;
const PREFIX_WEIGHT = 0.6;

export interface FileEntry {
  mtime: number;
  size: number;
  chunks: CodeChunk[];
}

export interface SerializedIndex {
  version: number;
  builtAt: string;
  files: Record<string, FileEntry>;
}

export const INDEX_FORMAT_VERSION = 3;

export interface MatchedTerm {
  term: string; // human-readable word
  via: "exact" | "concept" | "prefix";
}

export interface RankedResult {
  chunk: CodeChunk;
  score: number;
  relevance: number; // 0..100 display score
  matched: MatchedTerm[];
}

export interface IndexStats {
  files: number;
  functions: number;
  classes: number;
  chunks: number;
  languages: Record<string, number>;
}

export interface SearchOptions {
  topK: number;
  expand?: boolean; // concept expansion (default true)
}

interface Doc {
  chunk: CodeChunk;
  tf: Map<string, number>;
  len: number;
}

export class SearchIndex {
  private files = new Map<string, FileEntry>();
  private docs: Doc[] = [];
  private postings = new Map<string, { doc: number; tf: number }[]>();
  private surface = new Map<string, string>(); // stem -> readable word
  private avgLen = 1;
  private dirty = true;
  builtAt: string | null = null;

  // ------------------------------------------------------------ mutation

  setFile(path: string, entry: FileEntry): void {
    this.files.set(path, entry);
    this.dirty = true;
  }

  removeFile(path: string): boolean {
    const had = this.files.delete(path);
    if (had) this.dirty = true;
    return had;
  }

  clear(): void {
    this.files.clear();
    this.dirty = true;
    this.builtAt = null;
  }

  getFile(path: string): FileEntry | undefined {
    return this.files.get(path);
  }

  filePaths(): string[] {
    return Array.from(this.files.keys());
  }

  get isEmpty(): boolean {
    return this.files.size === 0;
  }

  // ------------------------------------------------------------ persistence

  toJSON(): SerializedIndex {
    return {
      version: INDEX_FORMAT_VERSION,
      builtAt: this.builtAt ?? new Date().toISOString(),
      files: Object.fromEntries(this.files),
    };
  }

  static fromJSON(data: SerializedIndex): SearchIndex | null {
    if (!data || data.version !== INDEX_FORMAT_VERSION || typeof data.files !== "object") return null;
    const idx = new SearchIndex();
    for (const [path, entry] of Object.entries(data.files)) idx.files.set(path, entry);
    idx.builtAt = data.builtAt;
    idx.dirty = true;
    return idx;
  }

  // ------------------------------------------------------------ stats

  stats(): IndexStats {
    let functions = 0;
    let classes = 0;
    let chunks = 0;
    const languages: Record<string, number> = {};
    for (const entry of this.files.values()) {
      const lang = entry.chunks[0]?.language;
      if (lang) languages[lang] = (languages[lang] ?? 0) + 1;
      for (const c of entry.chunks) {
        chunks++;
        if (c.kind === "function" || c.kind === "method") functions++;
        else if (c.kind === "class") classes++;
      }
    }
    return { files: this.files.size, functions, classes, chunks, languages };
  }

  // ------------------------------------------------------------ build

  private addTerms(tf: Map<string, number>, text: string, weight: number): number {
    let n = 0;
    for (const raw of splitIdentifiers(text)) {
      const word = raw.toLowerCase();
      const toks = tokenize(word);
      if (toks.length === 0) continue;
      const t = toks[0];
      if (!this.surface.has(t)) this.surface.set(t, word);
      tf.set(t, (tf.get(t) ?? 0) + weight);
      n += weight;
    }
    return n;
  }

  private rebuild(): void {
    if (!this.dirty) return;
    this.docs = [];
    this.postings.clear();
    let total = 0;
    for (const entry of this.files.values()) {
      for (const chunk of entry.chunks) {
        const tf = new Map<string, number>();
        let len = 0;
        len += this.addTerms(tf, chunk.name, FIELD_WEIGHTS.name);
        if (chunk.className) len += this.addTerms(tf, chunk.className, FIELD_WEIGHTS.className);
        len += this.addTerms(tf, chunk.file.replace(/\.[^.]+$/, ""), FIELD_WEIGHTS.path);
        if (chunk.doc) len += this.addTerms(tf, chunk.doc, FIELD_WEIGHTS.doc);
        len += this.addTerms(tf, chunk.code.join("\n"), FIELD_WEIGHTS.body);
        const docId = this.docs.length;
        this.docs.push({ chunk, tf, len: Math.max(len, 1) });
        total += len;
        for (const [term, f] of tf) {
          let list = this.postings.get(term);
          if (!list) {
            list = [];
            this.postings.set(term, list);
          }
          list.push({ doc: docId, tf: f });
        }
      }
    }
    this.avgLen = this.docs.length ? total / this.docs.length : 1;
    this.dirty = false;
  }

  // ------------------------------------------------------------ search

  search(rawQuery: string, opts: SearchOptions): RankedResult[] {
    this.rebuild();
    const { text, filters } = parseFilters(rawQuery);
    const expand = opts.expand ?? true;
    const N = this.docs.length;
    if (N === 0) return [];

    // --- 1. query terms (dedup; keep order for display)
    let base = Array.from(new Set(tokenize(text)));
    const isCodeQuery = base.length > 12; // "find similar code" passes a whole snippet
    if (isCodeQuery) {
      // keep the most distinctive terms only
      base = base
        .filter((t) => this.postings.has(t))
        .sort((a, b) => (this.postings.get(a)!.length - this.postings.get(b)!.length))
        .slice(0, 24);
    }
    if (base.length === 0) return [];
    // Show the user's own word for an exact match ("authentication", not "authenticated")
    const queryWord = new Map<string, string>();
    for (const w of splitIdentifiers(text)) {
      const t = tokenize(w.toLowerCase())[0];
      if (t && !queryWord.has(t)) queryWord.set(t, w.toLowerCase());
    }
    const label = (term: string, via: MatchedTerm["via"]) =>
      (via === "exact" ? queryWord.get(term) : undefined) ?? this.surface.get(term) ?? term;

    // --- 2. expansion: query term -> list of (index term, weight, via)
    type Expansion = { term: string; weight: number; via: MatchedTerm["via"] };
    const expansions = new Map<string, Expansion[]>();
    const vocab = Array.from(this.postings.keys());
    for (const q of base) {
      const list: Expansion[] = [];
      if (this.postings.has(q)) list.push({ term: q, weight: 1, via: "exact" });
      if (q.length >= 4) {
        let added = 0;
        for (const v of vocab) {
          if (v.length >= q.length + 3 && v.startsWith(q) && added < 8) {
            list.push({ term: v, weight: PREFIX_WEIGHT, via: "prefix" });
            added++;
          }
        }
      }
      if (expand && !isCodeQuery) {
        for (const r of relatedTerms(q)) {
          if (this.postings.has(r) && r !== q) list.push({ term: r, weight: SYNONYM_WEIGHT, via: "concept" });
        }
      }
      expansions.set(q, list);
    }

    // --- 3. BM25F accumulate per doc, tracking which query concepts matched
    const scores = new Map<number, number>();
    const covered = new Map<number, Map<string, MatchedTerm>>();
    for (const [q, list] of expansions) {
      // For each doc, only the best expansion of a query concept counts,
      // so a single concept cannot be "double counted" through synonyms.
      const best = new Map<number, { s: number; m: MatchedTerm }>();
      for (const e of list) {
        const posting = this.postings.get(e.term)!;
        const df = posting.length;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        for (const p of posting) {
          const d = this.docs[p.doc];
          const norm = p.tf * (K1 + 1) / (p.tf + K1 * (1 - B + B * d.len / this.avgLen));
          const s = e.weight * idf * norm;
          const prev = best.get(p.doc);
          if (!prev || s > prev.s) {
            best.set(p.doc, { s, m: { term: label(e.term, e.via), via: e.via } });
          }
        }
      }
      for (const [doc, { s, m }] of best) {
        scores.set(doc, (scores.get(doc) ?? 0) + s);
        let cov = covered.get(doc);
        if (!cov) {
          cov = new Map();
          covered.set(doc, cov);
        }
        cov.set(q, m);
      }
    }

    // --- 4. coverage boost + filters
    const ranked: RankedResult[] = [];
    for (const [doc, raw] of scores) {
      const chunk = this.docs[doc].chunk;
      if (!passesFilters(chunk, filters)) continue;
      const cov = covered.get(doc)!;
      let coverage = 0;
      for (const m of cov.values()) coverage += m.via === "exact" ? 1 : m.via === "prefix" ? 0.8 : 0.6;
      coverage /= base.length;
      const score = raw * (0.4 + 0.6 * coverage) * kindPrior(chunk.kind, chunk.endLine - chunk.startLine);
      ranked.push({ chunk, score, relevance: coverage, matched: Array.from(cov.values()) });
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.max(1, opts.topK));

    // --- 5. display score: blend of coverage and strength relative to best hit
    const best = top[0]?.score ?? 1;
    let ceiling = 99.4;
    for (const r of top) {
      const rel = 100 * (0.6 * r.relevance + 0.4 * (r.score / best));
      // keep the displayed percentage consistent with the rank order
      ceiling = Math.min(ceiling, rel);
      r.relevance = Math.round(ceiling * 100) / 100;
    }
    return top;
  }

  /** Index terms (readable) — used for "Find similar code" explanations / tests. */
  vocabularySize(): number {
    this.rebuild();
    return this.postings.size;
  }
}

/** Small structural prior: prefer concrete functions/methods over huge blocks. */
function kindPrior(kind: ChunkKind, span: number): number {
  if (kind === "block") return 0.75;
  if (kind === "class") return span > 80 ? 0.8 : 0.92;
  return 1;
}

// ---------------------------------------------------------------- filters

export interface QueryFilters {
  lang?: string;
  path?: string;
  kind?: string;
}

/** Supports `lang:python`, `in:backend/auth`, `kind:class` inside a query. */
export function parseFilters(query: string): { text: string; filters: QueryFilters } {
  const filters: QueryFilters = {};
  const text = query
    .replace(/\b(lang|in|kind):("[^"]+"|\S+)/gi, (_, key: string, value: string) => {
      const v = value.replace(/^"|"$/g, "").toLowerCase();
      if (key.toLowerCase() === "lang") filters.lang = v;
      else if (key.toLowerCase() === "in") filters.path = v.replace(/\\/g, "/");
      else filters.kind = v;
      return " ";
    })
    .trim();
  return { text, filters };
}

function passesFilters(chunk: CodeChunk, f: QueryFilters): boolean {
  if (f.lang) {
    const l = chunk.language.toLowerCase();
    const aliases: Record<string, string> = { py: "python", js: "javascript", ts: "typescript", cpp: "c++", golang: "go", cs: "c#" };
    if (l !== (aliases[f.lang] ?? f.lang)) return false;
  }
  if (f.path && !chunk.file.toLowerCase().includes(f.path)) return false;
  if (f.kind) {
    const k = f.kind === "classes" ? "class" : f.kind.replace(/(function|method|block)s$/, "$1");
    if (k === "function" ? !(chunk.kind === "function" || chunk.kind === "method") : chunk.kind !== k) return false;
  }
  return true;
}

export { stem };
