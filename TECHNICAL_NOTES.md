# SemantiCode — Technical Notes

## Components
| Layer | Files | Responsibility |
|---|---|---|
| Engine (pure TS) | `frontend/extension/src/engine/` | `tokenizer.ts` identifier splitting, stopwords, stemmer · `synonyms.ts` 39 concept groups · `chunker.ts` functions/methods/classes/module blocks for 12 languages · `searchIndex.ts` inverted index, BM25F, coverage, filters, JSON (de)serialisation |
| Extension host | `src/extension.ts`, `src/services/*`, `src/panels/*` | commands, status bar, Quick Search, Find Similar; `IndexService` (scan, incremental, persistence, file watcher); `SearchService` (local or backend); settings; history; sidebar host; Insights panel |
| Protocol | `src/shared/protocol.ts` ⇄ `webview-ui/src/messaging.ts` | typed `postMessage` contract |
| UI | `frontend/webview-ui/src` | React screens: Welcome, Search (+preview), Workspace, Index, History, Settings; `devHost.ts` answers messages when run in a plain browser |
| Backend | `backend/` | FastAPI; `services/indexer.py` (Python `ast` + brace chunker), `services/search_engine.py` (same ranking), `routes/search.py`, `routes/auth.py`; SQLAlchemy models; pytest |

## Ranking
score(q, d) = Σₜ wₜ · IDF(t) · f(t,d)(k1+1) / (f(t,d) + k1(1 − b + b·|d|/avgdl)),
k1 = 1.2, b = 0.75, IDF = ln(1 + (N − df + 0.5)/(df + 0.5)).
wₜ = 1 exact, 0.6 prefix (index term ≥ 3 chars longer), 0.4 related concept;
per query concept only the best expansion counts. f(t,d) is a field-weighted
count (name 4, doc 2.5, class 2, path 1.5, body 1). Final = score ×
(0.4 + 0.6·coverage) × kind prior (block 0.75, large class 0.8). Displayed
relevance = 60 % coverage + 40 % score/best, capped at 99.4 and kept
non-increasing.

## Indexing details
- Includes: enabled languages; excludes node_modules, .git, dist, out, build,
  venv, __pycache__, .next, target, coverage, vendor, *.min.js, files > 512 KB,
  binary files; max 5000 files (settings).
- Incremental: (mtime, size) unchanged → cached chunks reused.
- Persistence: `context.storageUri/index.json` (format version 3).
- Live: FileSystemWatcher, 500 ms debounce, save after 1.5 s.

## Build
- `frontend/webview-ui`: `npm run build` (tsc + Vite) → `frontend/extension/webview/main.js|css`.
- `frontend/extension`: `npm run compile` (esbuild) → `dist/extension.js`.
- Package: `npx @vscode/vsce package`.

## Tests
- `npx tsx test/engine.test.ts ../../demo-project` — ranking smoke test.
- `node test/integration.test.js ../../demo-project` — real bundle + fake `vscode` API (15 checks).
- `python -m pytest backend/tests -q` — engine + API (index, search, auth, ZIP upload, zip-slip).
- `scripts/check_ui.mjs` — Playwright walk-through of every screen, fails on console errors.
