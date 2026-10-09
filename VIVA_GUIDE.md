# SemantiCode — Viva Guide (quick reference)

The full preparation document (comparisons, 30 Q&A, roadmap) is the
"SemantiCode — Viva Preparation" doc. This file is the short version.

## 30-second pitch
"Normal editor search only finds the exact text you type — searching *login*
will not find `issue_token` or `verify_password`. SemantiCode indexes the open
project into functions, methods and classes, knows that *login, auth, jwt,
password* are related ideas, and ranks code units by how well they match what
I meant. One click opens the editor at the exact line. It runs entirely inside
VS Code, offline. An optional FastAPI backend serves the same engine as a REST
API with JWT login and a database."

## How it works (one paragraph each)
- **Index:** scan files (12 languages) → split into functions/methods/classes
  (Python by indentation, C-family by declaration regex + brace matching,
  top-level code as "module scope") → tokenize (`createAccessToken` → create
  access token, stopwords, stemming) → inverted index with field weights
  (name ×4, doc ×2.5, class ×2, path ×1.5, body ×1) → saved per workspace;
  re-index is incremental; saving a file updates the index.
- **Search:** tokenize query → expand with 39 programming concept groups
  (0.4 weight) and partial words (0.6) → BM25F score
  (k1 = 1.2, b = 0.75) → × (0.4 + 0.6 × coverage) → relevance % =
  60 % coverage + 40 % relative score → results with "matched" chips.

## Honest framing
It is concept-level semantic search on top of BM25F, not a neural embedding
model. Chosen for privacy, zero setup, speed (1–16 ms per query) and
explainability. Planned upgrade: hybrid BM25 + code embeddings, Tree-sitter,
and an "Ask" (RAG) mode.

## Demo (see PRESENTATION_SCRIPT.md)
F5 → *Run SemantiCode Extension (demo-project)* → Index Workspace →
"where is the jwt token created" → "user signup" (≈ register concept) →
"how do we refund a payment" (Java) → Open in Editor → Ctrl+Alt+Shift+F →
Find Similar Code on `hash_password` → `lang:java kind:class payment`.

## Publishing
1. marketplace.visualstudio.com/manage → Create publisher (unique ID).
2. Set `publisher` + `repository` in `frontend/extension/package.json`.
3. `cd frontend/extension && npm install && npx @vscode/vsce package`.
4. Publisher page → New extension → Visual Studio Code → upload the `.vsix`.
   (CLI alternative: `vsce login` with an Azure DevOps PAT, scope
   Marketplace → Manage; global PATs retire on 1 Dec 2026.)
5. Optional: `npx ovsx publish <file>.vsix -p <token>` for Open VSX.
