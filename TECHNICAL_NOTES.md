# SemantiCode — Technical Notes

Companion to `README.md` (product/user-facing) and `PRESENTATION_SCRIPT.md`
(viva answers). This document is the engineering reference: architecture,
data flow, algorithms, build system, and what is real vs. simulated.

---

## 1. System overview

SemantiCode is split into two independently-built npm projects that are
wired together at runtime by the VS Code extension host:

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code process (Extension Host)                            │
│                                                                │
│   extension/  — Node.js / CommonJS, bundled with esbuild      │
│   ├─ extension.ts         activation, command registration   │
│   ├─ panels/                                                  │
│   │   ├─ SidebarProvider.ts     WebviewViewProvider            │
│   │   └─ AdminDashboardPanel.ts  static-HTML WebviewPanel      │
│   └─ services/             real vscode.* API access            │
│                                                                │
│         │ postMessage (JSON, structurally typed)               │
│         ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Webview (Electron/Chromium sandbox, no Node access)   │    │
│  │                                                          │   │
│  │   webview-ui/  — React 18, bundled with Vite/esbuild    │   │
│  │   App.tsx → screens/*.tsx → components/*.tsx            │   │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

Two build tools are used deliberately for different reasons:

- **esbuild** (`extension/esbuild.js`) bundles the extension host code —
  fast, minimal config, standard for VS Code extensions, output is a
  single CommonJS file (`dist/extension.js`) with `vscode` marked
  `external` (it's injected by the extension host at runtime, never
  bundled).
- **Vite** (`webview-ui/vite.config.ts`) bundles the React app — gives a
  dev server for standalone iteration (`npm run dev`) plus a production
  build. Vite uses esbuild internally for transforms, so both toolchains
  ultimately share the same JS engine.

---

## 2. Technology stack vs. official project scope

| Scope item | This milestone | Notes |
|---|---|---|
| Frontend: React.js | ✅ implemented | `webview-ui/`, React 18 + TypeScript, no router (screen switching is local component state — see §4) |
| Backend: FastAPI | ❌ not implemented | Planned; see §9 |
| Code Parser: Tree-sitter | ❌ not implemented | Mock function/class extraction only |
| Embedding Model: CodeBERT | ❌ not implemented | `mockSearch()` uses keyword-overlap, not embeddings |
| Vector DB: FAISS | ❌ not implemented | — |
| Database: PostgreSQL / SQLAlchemy | ❌ not implemented | — |
| Auth: JWT | ⚠️ demoed only | The *sample codebase* (`demo-project/`) contains a real-looking JWT auth implementation used as search-result content; the extension itself has no auth layer (not needed for a local dev tool) |
| IDE: VS Code | ✅ implemented | Real extension (manifest, activation, commands, views) |
| Version Control: GitHub | N/A this milestone | `.gitignore` included; repo not yet initialized as git |

---

## 3. Project structure (file responsibility table)

### `extension/` (Node/CommonJS, TypeScript, `strict: true`)

| File | Responsibility |
|---|---|
| `src/extension.ts` | `activate()`/`deactivate()`. Registers the `WebviewViewProvider`, 4 commands. |
| `src/panels/SidebarProvider.ts` | Core of the extension. Builds the webview's HTML (with CSP + nonce), owns the `postMessage` router (`handleMessage`), implements `openFileAtRange()` using real `vscode.window.showTextDocument` / `TextEditorRevealType`. |
| `src/panels/AdminDashboardPanel.ts` | Secondary `WebviewPanel` (editor-area tab, not sidebar), singleton pattern (`currentPanel`). Renders static HTML string with inline `<style>` — no React, no scripts (`enableScripts: false`), so no CSP script-src needed. |
| `src/services/workspaceService.ts` | `detectWorkspace()` reads `vscode.workspace.workspaceFolders[0]` for real name/path; `detectPrimaryLanguage()` does a real (capped, try/caught) `findFiles` scan for a language guess. Statistics (`mockIndexStats`) are a separate, explicitly-named export — never conflated with the real fields. |
| `src/services/settingsService.ts` | `readSettings()` / `updateSetting()` — real bridge to `vscode.workspace.getConfiguration('semanticode')`. Converts between the webview's `Record<string, boolean>` language-toggle shape and the real config's `string[]`. |
| `src/services/historyService.ts` | Wraps `context.globalState` under key `semanticode.searchHistory`, capped at 30 entries. This is real persistence — survives reloading the Extension Development Host. |
| `src/data/adminMockData.ts` | Mock data *only* for the secondary admin dashboard. Deliberately not shared with `webview-ui`'s mock data — the two panels ship independently. |
| `src/messaging.ts` | TypeScript union types mirroring `webview-ui/src/messaging.ts` (see §4). Not a shared import — two separate compiler/bundler contexts (Node/CJS vs. browser/ESM) — kept in sync by convention and comments. |
| `esbuild.js` | Build script. `--production` → minified, one-shot build. `--watch` → incremental rebuild (not currently wired into `tasks.json`; see §8). |

### `webview-ui/` (browser/ESM, TypeScript, `strict: true`)

| File | Responsibility |
|---|---|
| `src/App.tsx` | All application state (`useState`): active screen, workspace, indexing steps/progress, search query/results, selected result, history, settings, toast. Owns the indexing-simulation timer chain and the `window.addEventListener("message", ...)` handler for host→webview messages. |
| `src/vscodeApi.ts` | `getVsCodeApi()` — returns the real `acquireVsCodeApi()` proxy inside a VS Code webview, or an in-memory shim (logs to console) when run standalone in a browser. This is what makes the *same build* usable both inside VS Code and via `npm run dev` / Playwright. |
| `src/messaging.ts` | Message contract, see §4. |
| `src/services/searchService.ts` | `mockSearch(query, topK)` — see §5 for the scoring algorithm. `apiSearch()` — unimplemented stub (throws), documents the intended future FastAPI contract. |
| `src/data/mockData.ts` | Centralized mock constants: `mockWorkspace`, `suggestedQueries`, `indexingStepsTemplate`, `defaultSettings`, `mockSearchHistory`. Re-exports `generatedSearchEntries`. |
| `src/data/searchEntries.generated.ts` | **Generated file** — see §6. Do not hand-edit. |
| `src/data/types.ts` | Shared TS interfaces (`WorkspaceInfo`, `SearchResult`, `HistoryEntry`, `IndexingStepState`, `SemantiCodeSettings`, `ScreenId`). Field names deliberately match the shape a future `/api/search` JSON response would use. |
| `src/screens/*.tsx` | One component per GUI screen (`WelcomeScreen`, `SearchScreen`, `WorkspaceScreen`, `IndexingScreen`, `HistoryScreen`, `SettingsScreen`). Screens compose components; they hold no state of their own — all state is lifted to `App.tsx` and passed down as props. |
| `src/components/*.tsx` | Presentational, reusable, mostly stateless. `CodeViewer.tsx` contains a small hand-rolled regex tokenizer for Python-ish syntax highlighting (no external highlighting library — see §7). |
| `src/styles/theme.css` | CSS custom properties, each defined as `var(--vscode-*, <dark-fallback>)` — see §7 for why. |
| `src/styles/app.css` | All component styling (BEM-ish `sc-` prefixed class names, no CSS Modules, no Tailwind). |

### `demo-project/`

Not part of the product — a small, real Python/FastAPI-shaped sample
codebase (`backend/auth/`, `backend/db/`, `backend/routes/`,
`backend/uploads/`, `backend/models/`, `backend/schemas/`) that exists
solely so the demo has real files to open. See §6.

### `scripts/`

| File | Responsibility |
|---|---|
| `gen_mockdata.py` | Regenerates `searchEntries.generated.ts` by reading real line ranges out of `demo-project/`. Deterministic — re-running with no source changes produces a byte-identical file (verified). |
| `check_ui.mjs` | Playwright script driving the built `webview-ui` (via `vite preview`) through all 8 screens, asserting zero browser console errors. Not part of the shipped product — a verification tool. |

---

## 4. Webview ⇄ extension host messaging protocol

Webviews are sandboxed (no Node/filesystem/VS Code API access), so all
communication is `postMessage` with plain JSON. Two mirrored discriminated
unions define the contract:

```ts
// webview -> host (webview-ui/src/messaging.ts: OutboundMessage)
| { type: "ready" }
| { type: "openFile"; file: string; startLine: number; endLine: number }
| { type: "searchExecuted"; query: string; resultCount: number }
| { type: "reindexWorkspace" }
| { type: "clearIndex" }
| { type: "updateSetting"; key: keyof SemantiCodeSettings; value: unknown }
| { type: "clearHistory" }

// host -> webview (webview-ui/src/messaging.ts: InboundMessage)
| { type: "workspaceInfo"; workspace: WorkspaceInfo }
| { type: "historyUpdated"; history: HistoryEntry[] }
| { type: "settingsInitial"; settings: SemantiCodeSettings }
| { type: "openFileAck"; file: string; ok: boolean }
```

**Design decision — who owns history during a live session:** the host
persists every `searchExecuted` event into `globalState` silently (no
reply), while the webview optimistically prepends to its own local
`history` state immediately after a search resolves. This means:
- the webview never has to wait on a round-trip to show a new history
  entry (feels instant),
- there's no risk of duplicate entries (host never echoes the entry back
  during a session),
- `historyUpdated` is only sent once, in response to `ready` — it exists
  purely to *hydrate* history from a previous VS Code session, not to
  keep the current session in sync.

**Design decision — workspace identity vs. workspace stats:** on `ready`,
the host replies with `workspaceInfo` containing the *real* folder name,
path, and a language guess. `App.tsx`'s handler deliberately overwrites
only those three fields and leaves `status`/`stats` untouched:

```ts
case "workspaceInfo":
  setWorkspace((prev) => ({
    ...prev,
    name: msg.workspace.name,
    path: msg.workspace.path,
    primaryLanguage: msg.workspace.primaryLanguage,
  }));
  break;
```

This was a deliberate fix during development — an earlier version merged
the host's (zeroed, pre-index) stats wholesale, which caused a flash of
`0 / 0 / 0 / 0` before the indexing simulation finished. Keeping mock
stats entirely webview-owned avoids that, and keeps the demo numbers
matching the project brief's example figures (248 files / 1,842
functions / 312 classes / 2,104 chunks) regardless of how many files
actually exist in whatever folder is really open.

---

## 5. Search ranking algorithm (`mockSearch`)

Lives entirely in `webview-ui/src/services/searchService.ts`. No network
call, no backend — pure client-side scoring against the 9 curated entries
in `generatedSearchEntries`.

1. **Tokenize** the query: lowercase, strip non-alphanumerics, split on
   whitespace, drop tokens ≤1 char.
2. **Strip stopwords** — a curated list (`where`, `is`, `the`,
   `implemented`, `handled`, etc.) chosen specifically so that questions
   phrased like the project brief's examples ("Where is JWT
   authentication **implemented**?") reduce to their content words
   (`jwt`, `authentication`).
3. For each entry, build a token set from its `tags[]` + tokenized
   `name` + tokenized `file` path + tokenized `className` (if any).
4. **Score overlap**: exact token match = 1 point; substring match in
   either direction = 0.5 point (so `"auth"` partially credits against
   `"authentication"`). `overlapRatio = overlap / queryTokenCount`,
   clamped to `[0, 1]`.
5. **Blend with a curated `baseScore`**:
   ```
   similarity = overlapRatio > 0
     ? baseScore * (0.55 + 0.45 * overlapRatio)
     : 35 + hashTo(entryId + query, 20)   // 35-55%, deterministic per query
   ```
   The `baseScore` values were chosen so that a full-token-overlap query
   reproduces the exact percentages from the project brief (94.21% /
   89.73% / 84.12%) — see §6.
6. Sort descending, slice to `topK`, map to the `SearchResult` shape.

`hashTo()` is a tiny string hash (not `Math.random()`) so that an
unrelated query always gets the *same* "weak match" score against a
given entry — the ranking is reproducible across runs, which matters for
a live demo (no flicker between identical searches).

This function is intentionally the *only* place ranking logic lives.
Nothing else in the codebase computes or adjusts a similarity score.

---

## 6. Mock-data generation pipeline (`scripts/gen_mockdata.py`)

Rather than hand-typing function names/line numbers/code snippets into
`mockData.ts` (which drifts from reality the moment a sample file is
edited), `gen_mockdata.py`:

1. Defines 9 `ENTRIES` — each an anchor into a real file in `demo-project/`
   (file path, 1-indexed `start`/`end` line, hand-curated `tags[]` and
   `baseScore`).
2. Opens each file, slices `lines[start-1:end]`, strips trailing
   newlines.
3. Emits `webview-ui/src/data/searchEntries.generated.ts` as a typed
   `const` array via `json.dumps(..., indent=2)` (valid JSON is valid
   TS object-literal syntax, so this needs no templating engine).

**Why this matters:** every "Open in Editor" click in the demo opens a
*real* file at a *real*, correct line — verified by construction, not by
hand. If `demo-project/` changes, re-running the script keeps
`startLine`/`endLine`/`code` in sync automatically; a stale generated
file would show a code preview that doesn't match what's actually on
disk.

**Verified idempotent:** re-running the script against an unchanged
`demo-project/` produces a byte-identical file (checked with `diff` during
development).

**The `baseScore` values were reverse-engineered from the brief's
example**, not arbitrary:

| Entry | `baseScore` | Reproduces |
|---|---|---|
| `authenticate_user` | 94.21 | Brief's exact example % |
| `verify_token` | 89.73 | Brief's exact example % |
| `login` (route) | 84.12 | Brief's exact example % |
| others | interpolated (76.8–92.6) | plausible but not from the brief |

Querying exactly `"Where is JWT authentication implemented?"` (after
stopword stripping, tokens = `{jwt, authentication}`, both of which are
in all three entries' `tags[]`, giving `overlapRatio = 1.0` for each)
reproduces 94.21% / 89.73% / 84.12% exactly, in that order.

---

## 7. Notable frontend implementation details

**Theming via real VS Code CSS variables.** `theme.css` defines every
color token as `var(--vscode-<token>, <dark fallback>)` rather than
hardcoding a palette. Real VS Code webviews inject `--vscode-*` custom
properties that track the user's actual color theme (dark/light/high
contrast) live; the fallback values (a Dark+-like palette) are what
render when the same build runs standalone in a browser (no VS Code
context providing those variables) — which is how it was screenshotted
and Playwright-tested in this environment.

**No external syntax-highlighting library.** `CodeViewer.tsx` implements
a ~40-line regex tokenizer (`TOKEN_RE`) recognizing Python triple/single
strings, comments, numbers, and a fixed keyword set, mapped to `tok-*`
CSS classes. This was a deliberate scope decision — sufficient for a
GUI-design milestone, avoids pulling in Prism/Shiki/Highlight.js and the
bundle-size/CSP considerations that come with them.

**No React Router.** Screen switching is a single `ScreenId` string in
`App.tsx` state, rendered via a chain of `{screen === "x" && <X />}`.
Chosen because: (a) a VS Code sidebar webview isn't a browsable multi-URL
surface the way a website is, (b) it avoids a routing dependency and its
CSP/base-path complications inside a `webview.asWebviewUri()`-rewritten
document, (c) the project brief itself says to adapt routing concepts to
"extension views/panels" rather than force browser routing.

**Content-Security-Policy.** `SidebarProvider.renderHtml()` sets:
```
default-src 'none';
img-src <cspSource> data:;
style-src <cspSource> 'unsafe-inline';
script-src 'nonce-<random>';
```
`style-src 'unsafe-inline'` is required because React writes inline
`style` attributes (e.g. `SimilarityScore`'s bar width). The script tag
carries a fresh nonce per webview render; this works because the Vite
build (`entryFileNames: "main.js"`, no `manualChunks`) emits exactly one
JS file — no dynamically-imported chunks that would need their own nonce
or `strict-dynamic`.

---

## 8. Build & run mechanics

```
.vscode/tasks.json
  "build SemantiCode (webview + extension)"   (default build task)
    1. "install extension deps"   → npm install          (path: extension)
    2. "build webview UI"         → npm run build-webview (path: extension)
                                      → cd ../webview-ui && npm install && npm run build
    3. "compile extension"        → npm run compile       (path: extension)
                                      → node esbuild.js --production

.vscode/launch.json
  type: extensionHost, request: launch
  args: --extensionDevelopmentPath=<root>/extension, <root>/demo-project
  preLaunchTask: ${defaultBuildTask}
```

All three build steps are **foreground/blocking**, not `esbuild --watch`
background tasks. This was a deliberate simplification: a watch-mode
task requires a correctly-configured VS Code *problem matcher* with
begin/end patterns matching esbuild's log output, which is easy to get
subtly wrong (VS Code either hangs waiting for a pattern that never
appears, or launches before the first build finishes). The tradeoff:
after editing extension source, you re-run the build task (or press F5
again) rather than getting hot-reload — acceptable for a demo/eval
project, not for heavy iterative extension development.

`extension/tsconfig.json` targets `Node16`/`ES2022` for type-checking
only (`tsc --noEmit`); esbuild does the actual transpile/bundle and
ignores `tsconfig`'s `module` setting. `webview-ui/tsconfig.json` targets
`ES2020`/`DOM`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.

---

## 9. What "future backend" integration actually changes

Because the mock/real boundary was drawn deliberately (§4, §5), wiring up
the real backend later should only touch:

1. `webview-ui/src/services/searchService.ts` — implement `apiSearch()`
   as a `fetch('/api/search', ...)` (or, more likely, another
   `postMessage` hop through the extension host, since a webview can't
   make direct network calls without `connect-src` in the CSP and CORS
   from FastAPI) and swap the call site in `App.tsx`'s `runSearch()`
   from `mockSearch(...)` to `await apiSearch(...)`.
2. `extension/src/services/workspaceService.ts` — replace
   `mockIndexStats` with a real call to a `/api/index` job and poll
   `/api/workspace/status`.
3. `extension/src/panels/SidebarProvider.ts`'s `reindexWorkspace` /
   `clearIndex` cases — currently no-ops with a `TODO`, would trigger the
   real indexing job.

No screen, component, message type, or prop shape needs to change — the
`SearchResult`/`WorkspaceInfo`/`IndexStats` interfaces in
`webview-ui/src/data/types.ts` were written to match the *intended* API
response shape from the start.

---

## 10. Verification performed (and what wasn't)

Performed in this (cloud, no-VS-Code) environment:
- `tsc --noEmit` clean on both `extension` and `webview-ui`.
- `esbuild.js --production` produces `dist/extension.js` with `vscode`
  correctly left as an external `require`.
- `vite build` produces `dist/{index.html,main.css,main.js}` with no
  code-split chunks (confirmed via `ls`).
- Playwright (`scripts/check_ui.mjs`) drove: welcome → index → indexing
  complete → search → results → code preview → open-in-editor (toast) →
  workspace → history → search-again → settings → settings-edited →
  input-validation-error → clear-index, capturing a screenshot at each
  step and asserting **zero** `console.error`/`pageerror` events.
- `gen_mockdata.py` re-run confirmed byte-identical output (determinism
  check).

Not performed (no VS Code binary available in this environment):
- Actually launching the Extension Development Host via F5.
- Manual confirmation that `vscode.window.showTextDocument` /
  `revealRange` behave as expected against a real editor instance.
- Manual confirmation that `semanticode.sidebar.focus` (VS Code's
  auto-generated per-view focus command) resolves correctly.

These are exactly the gaps closed by you running F5 locally per
`README.md` §4.
