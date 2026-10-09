// Engine smoke tests — run with: npx tsx test/engine.test.ts <folder>
// Indexes a folder with the same chunker + BM25F index the extension uses
// and prints the top results for a few natural-language queries.
import * as fs from "node:fs";
import * as path from "node:path";
import { chunkFile, languageOf } from "../src/engine/chunker";
import { SearchIndex } from "../src/engine/searchIndex";

const root = path.resolve(process.argv[2] ?? ".");
const SKIP = new Set(["node_modules", ".git", "dist", "out", ".venv", "venv", "__pycache__"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (languageOf(p)) acc.push(p);
  }
  return acc;
}

const t0 = Date.now();
const index = new SearchIndex();
for (const f of walk(root)) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const stat = fs.statSync(f);
  index.setFile(rel, { mtime: stat.mtimeMs, size: stat.size, chunks: chunkFile(rel, fs.readFileSync(f, "utf8")) });
}
const stats = index.stats();
console.log("stats", JSON.stringify(stats), "vocab", index.vocabularySize(), `${Date.now() - t0}ms`);

const queries = process.argv.slice(3).length ? process.argv.slice(3) : [
  "Where is user authentication implemented?",
  "Where is the JWT token generated?",
  "Where is the database connection created?",
  "Find code responsible for file uploads",
  "how are passwords hashed",
  "check if a token has expired",
  "lang:python kind:class user",
];
let failures = 0;
for (const q of queries) {
  const t = Date.now();
  const res = index.search(q, { topK: 3 });
  console.log(`\nQ: ${q}  (${Date.now() - t}ms)`);
  if (!res.length) failures++;
  for (const r of res) {
    console.log(`  ${r.relevance.toFixed(1)}%  ${r.chunk.className ? r.chunk.className + "." : ""}${r.chunk.name} [${r.chunk.kind}]  ${r.chunk.file}:${r.chunk.startLine}-${r.chunk.endLine}  via ${r.matched.map((m) => m.term + (m.via !== "exact" ? "~" + m.via : "")).join(", ")}`);
  }
}
const json = JSON.stringify(index.toJSON());
const restored = SearchIndex.fromJSON(JSON.parse(json));
if (!restored || restored.stats().chunks !== stats.chunks) { console.error("serialization round-trip FAILED"); failures++; }
else console.log(`\nserialization OK (${(json.length / 1024).toFixed(1)} KB)`);
process.exit(failures ? 1 : 0);
