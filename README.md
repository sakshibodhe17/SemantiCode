# SemantiCode — Semantic Code Search Engine (VS Code extension)

Ask your codebase a question in plain English — *"where is the JWT token
created?"* — and SemantiCode returns the exact **function / method / class**
that does it, ranked, explained, and one click away in the editor.

Everything runs locally inside VS Code. An optional FastAPI backend provides
the same engine as a REST API (plus users/JWT, history, ZIP repository import).

---

## 1. What is real (everything)

| Feature | How |
|---|---|
| Workspace indexing | `vscode.workspace.findFiles` → structural chunker → inverted index |
| Code units | Python (indentation + docstrings), JS/TS/Java/Go/C/C++/C#/PHP/Rust/Kotlin (declaration regex + brace matching), Ruby; top-level code as "module scope" blocks |
| Ranking | BM25F (name ×4, doc-comment ×2.5, class ×2, path ×1.5, body ×1) + identifier splitting + stemming + code-concept expansion + coverage boost |
| Explainability | every result lists the words / concepts that matched |
| Filters | `lang:python`, `in:src/api`, `kind:class` |
| Incremental re-index | unchanged files (same mtime + size) are reused |
| Live updates | file watcher re-parses saved / created / deleted files |
| Persistence | index cached in VS Code workspace storage; history in globalState |
| Quick Search | `Ctrl+Alt+Shift+F` — results while typing |
| Find Similar Code | select code → right-click → *Find Similar Code* |
| Index Insights | dashboard with real stats & recent searches |
| Backend (optional) | FastAPI + SQLAlchemy (SQLite/PostgreSQL), same ranking in Python, JWT auth, ZIP upload with zip-slip protection |

## 2. Repository structure

```
semanticode/
├── frontend/
│   ├── extension/                 VS Code extension (TypeScript, esbuild)
│   │   ├── src/
│   │   │   ├── extension.ts           commands, status bar, quick search, find similar
│   │   │   ├── engine/                pure TS, no VS Code dependency (unit-testable)
│   │   │   │   ├── tokenizer.ts       identifier splitting, stopwords, stemmer
│   │   │   │   ├── synonyms.ts        39 programming-concept groups
│   │   │   │   ├── chunker.ts         functions / classes / module blocks per language
│   │   │   │   └── searchIndex.ts     inverted index, BM25F, coverage, filters, (de)serialise
│   │   │   ├── services/
│   │   │   │   ├── indexService.ts    scanning, incremental index, persistence, watcher
│   │   │   │   ├── searchService.ts   local engine or FastAPI backend
│   │   │   │   ├── settingsService.ts real `semanticode.*` settings
│   │   │   │   └── historyService.ts  search history (globalState)
│   │   │   ├── panels/                SidebarProvider (React host), InsightsPanel
│   │   │   └── shared/protocol.ts     webview ⇄ extension message types
│   │   ├── test/                      engine + integration tests (fake vscode module)
│   │   ├── webview/                   built React UI (generated)
│   │   └── package.json               extension manifest
│   └── webview-ui/                React 18 + Vite UI shown in the sidebar
├── backend/                       FastAPI API (optional engine)
│   ├── services/indexer.py            Python AST + brace chunker
│   ├── services/search_engine.py      same BM25F + concepts as the extension
│   ├── routes/search.py               /api/index, /api/search, /api/repositories/upload …
│   ├── routes/auth.py                 register, login (JWT), /me
│   └── tests/                         pytest suite
├── demo-project/                  multi-language sample shop app for the demo
└── scripts/check_ui.mjs           Playwright UI check (browser preview mode)
```

## 3. Run it (development)

**Requirements:** Node.js 18+, VS Code 1.85+. (Python 3.10+ only for the backend.)

1. Open the `semanticode` folder in VS Code.
2. Press **F5** → *Run SemantiCode Extension (demo-project)*.
   The build task installs dependencies, builds the React UI into
   `frontend/extension/webview`, and bundles the extension.
3. In the new window click the SemantiCode icon in the Activity Bar →
   **Index Workspace** → search, e.g. *"how do we refund a payment"*.

Manual build:

```bash
cd frontend/webview-ui && npm install && npm run build
cd ../extension && npm install && npm run compile
```

## 4. Install it like a normal extension

```bash
cd frontend/extension
npx @vscode/vsce package          # -> semanticode-1.0.0.vsix
```

VS Code → Extensions view → `…` menu → **Install from VSIX…** → pick the file.

## 5. Tests

```bash
# engine (ranking quality smoke test)
cd frontend/extension && npx tsx test/engine.test.ts ../../demo-project
# extension integration test (real bundle + fake vscode API)
npm run compile && node test/integration.test.js ../../demo-project
# backend
cd ../.. && pip install -r backend/requirements.txt && python -m pytest backend/tests -q
# UI screenshots / console-error check
cd scripts && npm install && npx playwright install chromium && node check_ui.mjs
```

## 6. Backend (optional engine)

```bash
python -m venv .venv && .venv\Scripts\activate        # Windows
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

Open <http://127.0.0.1:8000/docs>. Then in VS Code set
`semanticode.engine` to `backend` (Settings screen → Engine) and run
*Index Workspace* — the extension sends the folder path to `POST /api/index`
and all searches go to `POST /api/search`.

| Endpoint | Purpose |
|---|---|
| `POST /api/index` | index a local folder |
| `POST /api/repositories/upload` | upload a `.zip` repository and index it |
| `POST /api/search` | ranked results with `matched` explanations |
| `GET /api/workspace/{id}/status`, `GET /api/workspaces`, `DELETE /api/workspace/{id}` | manage indexes |
| `GET /api/search/history/{id}` | search history |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | users + JWT |
| `GET /health` | DB health check |

## 7. Publishing to the VS Code Marketplace

See `frontend/extension/README.md` (marketplace page) and the Publishing
section of `VIVA_GUIDE.md`. In short: create a publisher on
<https://marketplace.visualstudio.com/manage>, set `publisher` and
`repository` in `frontend/extension/package.json`, run `npx @vscode/vsce
package`, then upload the `.vsix` on the publisher page (or `vsce publish`).
