# SemantiCode Viva Guide

## 30-second introduction

“SemantiCode is a VS Code extension for searching a codebase using a developer’s natural-language query. Instead of only matching an exact word, it breaks the codebase into meaningful units such as functions and classes, ranks the relevant units, and opens the selected result at the correct line in VS Code. The frontend is React inside a VS Code webview; the backend is a FastAPI REST API; SQLite persists workspaces, code chunks, users, and search history. The current searchable baseline uses AST-based extraction and offline token ranking. The scalable final design replaces the ranker with CodeBERT embeddings and FAISS vector search.”

## Problem and objective

Large projects are difficult to understand, especially for a new developer. Traditional search finds exact text; it may miss a function named `create_access_token` when the user searches “JWT login”. SemantiCode aims to reduce that discovery time by showing the most relevant code unit, its file, line range, and preview inside the editor.

## Architecture

```
User query in VS Code webview (React)
             │
             ▼
VS Code extension host (TypeScript: commands, file opening, settings)
             │ HTTP / JSON
             ▼
FastAPI backend
  ├─ Indexer: scans source and extracts AST code chunks
  ├─ Search service: ranks chunks for a query
  ├─ Auth service: hashed passwords and JWT
  └─ SQLAlchemy ORM
             │
             ▼
SQLite database now / PostgreSQL later
```

## What each technology does

| Technology | Reason used |
| --- | --- |
| VS Code Extension API | Integrates search into a developer’s normal workspace and can open a real file at a line. |
| React + TypeScript | Builds a responsive, component-based webview UI with type safety. |
| FastAPI | Provides fast Python REST endpoints, request validation through Pydantic, and automatic Swagger documentation. |
| SQLAlchemy | Keeps database operations in ORM models, so SQLite can later be replaced by PostgreSQL with small configuration changes. |
| SQLite | A zero-setup, local relational database suitable for the academic demo. |
| Python AST | Parses Python source structurally to identify functions/classes more reliably than plain regex. |
| JWT + bcrypt/passlib | JWT carries signed short-lived identity claims; bcrypt hashes passwords so plaintext passwords are never stored. |
| Planned: CodeBERT + FAISS | CodeBERT creates dense vectors representing code/query meaning; FAISS retrieves nearest vectors efficiently. |

## Database design

| Table | Main fields | Why it exists |
| --- | --- | --- |
| `users` | id, username, email, password_hash, role | Authentication and access control. |
| `login_attempts` | username, success, attempted_at | Audit trail and future rate limiting. |
| `workspaces` | id, path, indexed_at, file_count, chunk_count | One record per indexed codebase. |
| `code_chunks` | workspace_id, file_path, symbol_name, lines, content, search_text | The actual units being searched. |
| `search_history` | workspace_id, query, result_count, searched_at | Search analytics and history display. |

`code_chunks.workspace_id` is a foreign key to `workspaces.id`, so one workspace has many code chunks. This prevents mixing search results from different repositories.

## How indexing and searching work today

1. The client sends a workspace id and folder path to `POST /api/index`.
2. The indexer recursively scans supported source files, excluding folders like `.git`, `node_modules`, `dist`, and virtual environments.
3. For Python, the AST parser finds each function, async function, and class. It saves its name, file, start/end line and source text as one chunk.
4. Search text is normalized: identifiers such as `createAccessToken` become searchable terms like `create access token`.
5. `POST /api/search` tokenizes the query and scores every chunk by term overlap. Highest scores are returned first and the query is stored in `search_history`.

Be honest: this is an **offline baseline ranking**, not full semantic ML yet. It proves the complete data flow—source → structured chunks → database → API → ranked results. The next improvement is replacing step 5 with embeddings.

## Final semantic-search design

During indexing, CodeBERT converts each code chunk into a fixed-length embedding vector. Vectors are stored in a FAISS index, while PostgreSQL stores associated metadata such as file name, symbol and line range. During search, the query is converted into the same vector space; cosine similarity or inner product finds the nearest chunks in FAISS; the backend then gets metadata by vector id and sends the ranked results to the extension. FAISS is used because comparing a query against every vector becomes slow for a large codebase.

## Live demo sequence

1. Open the repository folder in VS Code.
2. Start the API: `python -m uvicorn backend.main:app --reload --port 8000`.
3. Open `http://127.0.0.1:8000/docs`, call `/health`, then index the current project with path `.` and workspace id `semanticode`.
4. Search “JWT authentication” or “database connection”. Show returned file paths, symbols, line numbers, and code snippet.
5. Stop the API only after the backend demo, then press **F5** in VS Code to launch the Extension Development Host. Show the SemantiCode sidebar, indexing flow, search UI, preview, history, settings, and Open in Editor.

## Likely viva questions and answers

1. **What is semantic code search?** It retrieves code by intended meaning, not just identical keywords. A final embedding model can match related concepts even when terms differ.

2. **How is it different from Ctrl+F or grep?** Ctrl+F does lexical exact-text search. SemantiCode indexes functions and classes, ranks units, shows their context, and is designed to use semantic vector similarity.

3. **Why a VS Code extension instead of a web application?** Developers already work in VS Code. Integration keeps the workflow in one place and lets a result open directly at its exact source line.

4. **What is a code chunk?** A meaningful searchable unit: currently a Python function, async function, class, or a supported non-Python source file. Chunking gives better context than indexing an entire repository as one document.

5. **Why use AST?** AST understands language structure, so it can identify a function boundary even if formatting changes. Regex cannot reliably handle nested syntax.

6. **Why use FastAPI?** It is lightweight, fast, has Pydantic validation, type hints, clear route definitions, and creates interactive API documentation automatically.

7. **What is REST in your project?** The UI/extension calls stateless HTTP endpoints such as `POST /api/index` and `POST /api/search`, exchanging JSON request and response bodies.

8. **Why SQLite, and when would you use PostgreSQL?** SQLite requires no server and is ideal for a local demo. PostgreSQL is better for concurrent users, larger deployments, access management, and robust production operations.

9. **What does SQLAlchemy do?** It maps Python classes to relational tables and handles database queries, reducing raw SQL and keeping code portable between database engines.

10. **What are primary key and foreign key here?** A primary key uniquely identifies a row, such as `workspaces.id`. A foreign key such as `code_chunks.workspace_id` references that workspace and forms the one-to-many relationship.

11. **How do you secure passwords?** Passwords are hashed with bcrypt through passlib. The original password is not stored; login verifies a supplied password against the hash.

12. **What is JWT?** JSON Web Token is a signed token returned after login. It contains claims such as user id and expiry. A client sends it as a bearer token for protected endpoints; the server verifies its signature.

13. **What does CORS do?** CORS controls which browser origins may call an API. It is configured so the local UI can request the local FastAPI service during development.

14. **How is ranking calculated now?** The baseline normalizes query and chunk terms, counts their overlap, and sorts chunks descending by the percentage of query terms matched.

15. **Why is that not fully semantic?** It still relies on overlapping words. Semantic retrieval will use CodeBERT embeddings, where related concepts can be close even with different words.

16. **What are embeddings?** They are arrays of numbers produced by a model that encode contextual meaning. Similar code/query meaning produces vectors that are closer.

17. **Why FAISS?** FAISS performs efficient nearest-neighbor search on many vectors; it avoids comparing a query against every vector one by one at large scale.

18. **What similarity metric would you use?** Cosine similarity is common because it compares vector direction rather than magnitude. If vectors are normalized, inner product gives the same ordering.

19. **How do you handle a code change?** Reindex the workspace: remove outdated chunks for that workspace, parse the current files, and save fresh chunks. A future version can index only changed files using file hashes.

20. **What errors are handled?** Invalid/missing folder returns HTTP 422; searching an unindexed workspace returns 404; invalid input is rejected by Pydantic; duplicate user details return 409; incorrect login returns 401.

21. **What are the limitations?** The extension UI has not yet been wired to call the API, ranking is an offline token baseline, AST extraction currently gives deepest structural support to Python, and local path indexing is intentionally for trusted local projects.

22. **How would you improve scalability?** Use CodeBERT embeddings and FAISS, PostgreSQL, background indexing jobs, incremental indexing, authentication/authorization on every API route, and Docker-based deployment.

23. **How was the project tested?** The frontend builds and has UI checks; the backend is verified by indexing the source folder, searching stored chunks, checking `/health`, and using FastAPI `/docs` for endpoint testing.

