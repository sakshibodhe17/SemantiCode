# SemantiCode — Semantic Code Search for VS Code

Ask your codebase questions in plain English and jump straight to the code.

> **"where is the JWT token created?"** → `issue_token()` · `api/auth.py:26` — one click opens it.

SemantiCode indexes the folder you have open into **functions, methods and
classes** (not lines or whole files), then ranks them against your question
using a code-aware search engine. It runs **entirely on your machine** — no
account, no API key, no code uploaded anywhere.

## Features

- **Natural-language search** in the SemantiCode sidebar (activity bar icon).
- **Quick Search** from anywhere: `Ctrl+Alt+Shift+F` (`Cmd+Alt+Shift+F` on macOS), results update as you type.
- **Find Similar Code**: select code → right-click → *Find Similar Code* (`Ctrl+Alt+Shift+S`) to find duplicates or related implementations.
- **Explainable results**: every hit shows *why* it matched — exact words, partial words, or related concepts (≈ login ↔ auth ↔ jwt).
- **Structure-aware**: understands Python (indentation), and JavaScript, TypeScript, Java, Go, C, C++, C#, PHP, Rust, Kotlin and Ruby (declarations + braces).
- **Filters** inside the query: `lang:python`, `in:src/api`, `kind:class` / `kind:function`.
- **Incremental & live**: re-indexing only re-parses changed files; saving a file updates the index automatically.
- **Persistent**: the index is cached per workspace, so it is ready instantly next time.
- **Index Insights** dashboard: files, functions, classes, languages and recent searches.
- Optional **FastAPI backend** mode for teams (same ranking, central index).

## How it works

1. **Scan** — files of the enabled languages, skipping `node_modules`, `.git`, build output, virtual envs and very large/minified files.
2. **Chunk** — each file is split into functions / methods / classes (plus "module scope" blocks for top-level code), keeping exact line ranges and docstrings / doc-comments.
3. **Index** — identifiers are split (`createAccessToken` → *create access token*), stemmed (*authentication* ≈ *authenticate*) and stored in an inverted index with field weights (name ×4, doc-comment ×2.5, class ×2, path ×1.5, body ×1).
4. **Rank** — BM25F scoring + concept expansion from a curated programming thesaurus, multiplied by *coverage* (how many of your query's ideas a result contains).

## Commands

| Command | Description |
|---|---|
| `SemantiCode: Quick Search by Meaning…` | Search from a quick-pick, live as you type |
| `SemantiCode: Find Similar Code` | Search with the current selection |
| `SemantiCode: Index Workspace` | Build / refresh the index |
| `SemantiCode: Clear Index` | Delete the cached index |
| `SemantiCode: Show Index Insights` | Statistics dashboard |
| `SemantiCode: Open Semantic Code Search` | Focus the sidebar |

## Settings

| Setting | Default | |
|---|---|---|
| `semanticode.topK` | `10` | Results per search |
| `semanticode.supportedLanguages` | all | Languages to index |
| `semanticode.exclude` | `[]` | Extra globs to skip |
| `semanticode.maxFiles` | `5000` | File limit |
| `semanticode.maxFileSizeKB` | `512` | Skip larger files |
| `semanticode.autoIndexOnSave` | `true` | Live index updates |
| `semanticode.queryExpansion` | `true` | Related-concept matching |
| `semanticode.engine` | `local` | `local` or `backend` |
| `semanticode.backendUrl` | `http://127.0.0.1:8000` | FastAPI server |

## Privacy

Your code never leaves your computer in the default `local` engine. The
index is stored in VS Code's per-workspace storage folder and can be removed
at any time with *SemantiCode: Clear Index*.

## Limitations

- Ranking is lexical + concept-based, not a neural embedding model: it is fast, offline and explainable, but it cannot understand a query that shares no words *or* concepts with the code.
- Brace-language parsing is heuristic (regex + brace matching), not a full parser.
