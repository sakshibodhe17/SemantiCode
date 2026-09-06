# SemantiCode — Semantic Code Search Engine

**Academic project title:** Semantic Code Search Engine
**Student:** Sakshi Bodhe (2501025)
**Current milestone:** Evaluation 2 — Activity 4: Input Design and Output Design (GUI)

This repository contains a working GUI prototype of the Semantic Code
Search Engine, built as a **VS Code extension** rather than a standalone
website. This README explains what was built for this milestone, why it
looks the way it does, and how to run it.

---

## 1. Product concept

A developer already has their project open in VS Code. Instead of leaving
the editor, zipping their project, uploading it to a website, and
searching there, they open the **SemantiCode** panel in the sidebar and
ask a question in plain English:

> "Where is JWT authentication implemented?"

SemantiCode is meant to search the currently open workspace semantically
(by meaning, not by exact keyword) and return ranked results such as:

```
94.21% similarity
authenticate_user()
backend/auth/service.py
Lines 30–47
```

Clicking a result opens the real file in the editor at the real line.

### Why IDE integration instead of a website?

The official project scope supports repository upload and repository
management, and that capability is preserved (see "Repository import" in
section 6). However, the *primary* developer workflow has been designed
around the currently open VS Code workspace, because:

- Developers already have their project open in an editor; asking them to
  zip and upload it interrupts their workflow.
- "Open in Editor → jump to line" is only meaningful inside an IDE.
- Re-indexing after a code change is far more natural as an in-editor
  action than a website upload.

Repository import/upload remains available as a secondary, optional
capability, fully in line with the original project scope — we have not
removed anything from it, only chosen where the primary interaction
happens.

---

## 2. What this milestone actually implements

Evaluation 2 evaluates **Activity 4: Input Design and Output Design**. Per
the brief, the goal is a polished, navigable GUI with placeholders for
input/output — **not** the final AI system. Accordingly:

| Layer | Status this milestone |
|---|---|
| GUI (VS Code extension + React webview) | **Real**, fully working, built and tested |
| Opening a file at a line ("Open in Editor") | **Real** — uses `vscode.window.showTextDocument` |
| Workspace name / path detection | **Real** — reads the actual open VS Code folder |
| Settings (Top-K, supported languages) | **Real** — reads/writes actual VS Code settings |
| Search history persistence | **Real** — uses VS Code's `globalState`, survives reloads |
| Search ranking / similarity scores | **Mock** — keyword-overlap scoring, clearly isolated in `mockSearch()` |
| Indexing progress / statistics | **Simulated** — animated, using the example numbers from the project brief |
| Tree-sitter / CodeBERT / FAISS / PostgreSQL / FastAPI | **Not implemented** — planned for later milestones |

The boundary between "real" and "mock" is deliberately explicit in the
code (see `webview-ui/src/services/searchService.ts`): `mockSearch()` is
what runs today; `apiSearch()` is a documented stub for the future FastAPI
endpoint. Nothing pretends the AI pipeline already works.

---

## 3. Repository structure

```
semanticode/
├── extension/            VS Code extension (TypeScript, esbuild)
│   ├── src/
│   │   ├── extension.ts          activation, command registration
│   │   ├── panels/
│   │   │   ├── SidebarProvider.ts    hosts the React webview in the sidebar
│   │   │   └── AdminDashboardPanel.ts  secondary admin dashboard (static HTML)
│   │   ├── services/
│   │   │   ├── workspaceService.ts   real workspace/folder detection
│   │   │   ├── settingsService.ts    real VS Code settings read/write
│   │   │   └── historyService.ts     real search-history persistence
│   │   ├── data/adminMockData.ts     mock data for the admin dashboard only
│   │   └── messaging.ts              webview <-> extension message contract
│   └── package.json                  extension manifest (views, commands, settings)
│
├── webview-ui/            React app rendered inside the extension's sidebar
│   └── src/
│       ├── screens/       one component per GUI screen (Welcome, Search, Workspace, ...)
│       ├── components/    reusable pieces (SearchResult, CodeViewer, StatusBadge, ...)
│       ├── data/
│       │   ├── mockData.ts               centralized mock data
│       │   └── searchEntries.generated.ts  auto-generated from real files in demo-project/
│       ├── services/searchService.ts     mockSearch() today / apiSearch() TODO
│       └── App.tsx                       screen state, indexing simulation, messaging
│
├── demo-project/             sample codebase used ONLY to demo the extension
│   └── backend/...          real, small FastAPI-shaped Python files
│
├── scripts/
│   ├── gen_mockdata.py     regenerates searchEntries.generated.ts from demo-project/
│   └── check_ui.mjs        automated screenshot + console-error check (Playwright)
│
└── .vscode/                 launch.json + tasks.json so F5 just works
```

### Why a `demo-project/` sample folder exists

The search results shown in the demo (function names, file paths, line
numbers, code snippets) are **not hand-typed strings** — they are
generated by `scripts/gen_mockdata.py`, which reads the real files under
`demo-project/` and copies the exact line numbers and code text. That means
when "Open in Editor" is clicked during a demo, it opens a real file at
the real, correct line — the only thing that is mocked is the *similarity
ranking*, not the file navigation.

---

## 4. How to run it

1. Open the **`semanticode`** folder (this repository's root — the one
   containing `extension/`, `webview-ui/`, and `demo-project/`) in VS Code.
2. Press **F5** (or `Run and Debug → Run SemantiCode Extension`).
   - The build task installs `webview-ui`'s dependencies and builds it,
     then compiles the extension with esbuild. First run takes a little
     longer because of `npm install`.
   - A new **Extension Development Host** window opens with the
     `demo-project` folder as its workspace.
3. In that new window, click the SemantiCode icon in the Activity Bar
   (left-hand icon rail) to open the sidebar panel.
4. Follow the demo flow below.

If you'd rather build manually:

```bash
cd webview-ui && npm install && npm run build
cd ../extension && npm install && npm run compile
```

then press F5 (the build task will simply find everything already built).

---

## 5. Demo flow (matches the Evaluation 2 walkthrough)

1. **Home** — workspace `demo-project` is detected automatically (no
   upload). Statistics show 248 source files (pre-index).
2. Click **Index Workspace** → animated indexing steps run (workspace
   detected → scanning → parsing → extracting → chunking → embeddings →
   FAISS index → ready) → final stats (248 files, 1,842 functions, 312
   classes, 2,104 chunks, 12.8s) → status **READY**.
3. Click **Continue to Search**, or the **Search** icon in the rail.
4. Type a query, e.g. *"Where is JWT authentication implemented?"* (or
   click one of the suggested queries) → **Search**.
5. Ranked results appear with similarity scores, function/class name,
   file path, and line numbers.
6. Click a result → the **Code Preview** panel shows line numbers +
   syntax-highlighted code.
7. Click **Open in Editor** → the real file opens in the VS Code editor
   at the real line (this part is not mocked).
8. Open **History** → previous queries are listed; **Search Again**
   re-runs one.
9. Open **Settings** → embedding model / vector search engine /
   similarity metric (placeholders), Top-K results and supported
   languages (these two are real, live VS Code settings).
10. *(Optional, secondary)* Run the command **"SemantiCode: Open Admin
    Dashboard"** from the Command Palette to see the conceptual admin
    view (users, repositories, search logs) — intentionally minimal, per
    the project scope's priority on the developer-facing IDE experience.

---

## 6. Input design

| Input | Where | Type / validation |
|---|---|---|
| Natural-language query | Search screen | text, min. 4 characters, inline error state |
| Number of results (Top-K) | Search screen + Settings | dropdown / number field (1–50) |
| Workspace | Auto-detected from VS Code (read-only) | — |
| Index Workspace / Re-index / Clear Index | Workspace & Index screens | button actions |
| Top-K results, supported languages | Settings screen | number input, checkboxes — real VS Code settings |
| Search Again | History screen | button, re-runs a stored query |

## 7. Output design

| Output | Where | Fields shown |
|---|---|---|
| Search results | Search screen | similarity %, function, class (if any), file, path, start/end line |
| Code preview | Code Preview panel | line numbers, syntax highlighting, file path, similarity |
| Indexing output | Index screen | step-by-step progress, files/functions/classes/chunks, elapsed time, status |
| Workspace output | Workspace screen | name, path, primary language, index status, statistics |
| History output | History screen | query text, workspace, timestamp, result count |

---

## 8. Future backend architecture

Nothing below is implemented yet — this section documents the target
architecture so the GUI's data flow already matches what the real
pipeline will need.

```
Developer query (natural language)
        │
        ▼
   CodeBERT  →  query embedding
        │
        ▼
   FAISS similarity search  →  top-K vector IDs
        │
        ▼
   PostgreSQL metadata lookup  →  file + function + line numbers
        │
        ▼
   Ranked results returned to the VS Code extension
        │
        ▼
   IDE opens the file at the matched location
```

Planned FastAPI endpoints (see `webview-ui/src/services/searchService.ts`
and `extension/src/messaging.ts` for where these will plug in):

```
POST /api/search              { query, workspace_id, top_k } -> ranked results
POST /api/index                start/refresh indexing for a workspace
GET  /api/workspace/status     current index status + stats
POST /api/reindex
GET  /api/search/history
GET  /api/repositories
GET  /api/repositories/{id}
```

**Tree-sitter** will replace the current mock function/class extraction.
**CodeBERT** will replace `mockSearch()`'s keyword-overlap scoring with
real embeddings. **FAISS** will replace the in-memory tag matching with a
real vector index. **PostgreSQL** (via **SQLAlchemy**) will store
file/function/chunk metadata keyed by FAISS vector IDs, replacing the
static `mockData.ts` / `adminMockData.ts` files. **JWT** authentication
will protect these endpoints once the admin dashboard becomes more than a
conceptual prototype.

---

## 9. What was verified for this milestone

- `webview-ui` builds cleanly (`tsc --noEmit && vite build`, zero errors).
- `extension` type-checks and bundles cleanly (`tsc --noEmit`, `esbuild`).
- An automated Playwright pass (`scripts/check_ui.mjs`) drives all 8
  screens end-to-end (index → search → preview → open-in-editor →
  history → search-again → settings → validation states → clear index)
  against the built UI and asserts **zero browser console errors**.
- `scripts/gen_mockdata.py` was re-run and produces byte-identical
  output, confirming every search result's file path / line numbers /
  code snippet is generated from — not hand-typed to merely resemble —
  the real files in `demo-project/`.

What was **not** verified in this environment: actually launching the VS
Code Extension Development Host (no VS Code binary is available in the
cloud sandbox this was built in). The extension manifest, TypeScript, and
bundle all follow the standard `esbuild`-based VS Code extension template
and compile cleanly; F5 in a real VS Code install is the remaining check,
covered by the demo flow above.
