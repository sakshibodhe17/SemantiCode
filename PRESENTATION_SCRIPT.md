# Evaluation 2 — Presentation / Viva Script

Simple, spoken-language answers for each expected question. Practice
these in your own words — they're written to be said out loud, not read
off a slide.

---

### Opening — "What is your project?"

"My project is a Semantic Code Search Engine. Instead of searching code
by exact keywords like Ctrl+F or grep, it lets a developer type a plain
English question — like 'where is JWT authentication handled?' — and get
back the actual function that does that, ranked by how closely its
*meaning* matches the question. We're building it as a tool that lives
inside VS Code, because that's where developers already work."

### Problem — "Why is normal keyword search insufficient?"

"Keyword search only finds exact text matches. If I search for
'authentication' but the function is named `authenticate_user` and never
contains the literal word 'authentication' anywhere near the logic, or if
a developer searches using different words than the ones in the code —
say 'login check' instead of 'verify credentials' — keyword search
misses it. A large codebase might have the right function using
completely different wording. Semantic search instead compares *meaning*
using code embeddings, so it can find the right function even when the
words don't match exactly."

### Solution — "Why an IDE-integrated semantic search tool?"

"We use CodeBERT to convert code into embeddings — numeric vectors that
capture meaning — and FAISS to search those vectors for the closest
matches to a query, which is also converted into an embedding. Tree-sitter
parses the code first so we know where each function and class starts
and ends. PostgreSQL stores the metadata — which file, which lines, which
function — connected to each vector. That's the plan; this milestone is
only the interface for it."

### Input Design — "What inputs does the developer provide?"

"Four main inputs. First, the natural-language query itself, typed into
a search box — we validate it's at least 4 characters and show an error
state if not. Second, the number of results they want back, a dropdown
from 5 to 20. Third, actions like 'Index Workspace' or 'Re-index' —
buttons, not typed input, because we don't want the developer typing a
project path; the workspace is auto-detected from the folder they already
have open in VS Code. Fourth, settings — how many top results by default,
and which programming languages to index — both stored as real VS Code
settings, not just fake placeholders."

### Output Design — "What outputs does the system provide?"

"Search results are the main output: for each match we show a similarity
percentage, the function name, the class name if it belongs to one, the
file path, and the exact start and end line numbers, plus a short code
preview. Clicking a result opens a full code viewer with line numbers and
syntax highlighting. We also output indexing statistics — files,
functions, classes, code chunks, and how long indexing took — and a
search history showing past queries with timestamps."

### Search Flow — "What happens after the developer enters a query?"

"Right now, for this milestone: the query is compared against a small set
of tagged example functions using simple keyword overlap, and we return
results ranked by a similarity score. That's clearly a placeholder — it's
isolated in one function called `mockSearch()` in the code. Eventually,
`mockSearch()` gets replaced by a real API call: the query goes to
FastAPI, FastAPI runs it through CodeBERT to get an embedding, FAISS finds
the nearest code vectors, and PostgreSQL supplies the file/function/line
metadata for those vectors. The rest of the app — the screens, the
components, the message format — doesn't need to change when that swap
happens, because we deliberately built that seam in now."

### Future AI — "How will CodeBERT and FAISS eventually be used?"

"CodeBERT is a version of the BERT language model pretrained on source
code instead of natural language text — it turns both code and natural-
language queries into vectors in the same embedding space, so a query and
the code that matches it end up close together mathematically. FAISS —
Facebook AI Similarity Search — is a library built to search millions of
these vectors very fast and return the closest ones. So the pipeline is:
Tree-sitter breaks the codebase into functions and classes ('chunks'),
CodeBERT turns each chunk into a vector and stores it in FAISS, and at
search time the query is turned into a vector too and FAISS finds the
nearest chunks to it."

### IDE Integration — "Why an extension instead of uploading to a website?"

"The original scope does support uploading a repository, and we kept
that as a secondary option — we didn't remove it. But think about how a
developer actually works: their code is already open in VS Code. Asking
them to zip it, upload it to a website, wait for processing, and search
there breaks their workflow completely, and it gets stale the moment
they edit a file. An IDE extension can just read the currently open
workspace directly — no zip, no upload, no wait — and when they click a
result, it can jump straight to that line in their own editor, which a
website could never do. So we designed the *primary* interface around the
workspace already open in VS Code, and kept upload/import as an
additional capability for cases like reviewing someone else's repository
you haven't opened locally."

### Current Status — "What have you implemented for Evaluation 2?"

"A complete, working GUI, built as a real VS Code extension with a React
interface inside it — eight screens: Welcome, Search, Search Results,
Code Preview, Indexing, Workspace Info, Search History, and Settings.
Several parts are genuinely functional already, not mocked: opening a
file and jumping to a line really uses VS Code's own editor API, the
workspace name and path are read from the actual open folder, search
history is saved using VS Code's storage so it survives restarting the
editor, and the Top-K and language settings are real VS Code settings you
can see in settings.json. What's mocked is clearly isolated: the search
ranking itself, and the indexing statistics, both live in their own
functions that are meant to be replaced later — they're not scattered
around pretending to be real."

### Future Work — "What's next?"

"The next milestones build the actual backend: a FastAPI server exposing
a `/api/search` endpoint, Tree-sitter parsing real source files into
functions and classes, CodeBERT generating real embeddings for them,
FAISS indexing those embeddings for fast search, and PostgreSQL storing
the metadata that connects a FAISS result back to a specific file and
line range. Once that exists, we replace `mockSearch()` in the extension
with a real API call — the interface you're looking at today doesn't need
to change to support that, because we built the message-passing and data
shapes around that future API from the start."

---

## Quick-reference numbers (in case you're asked)

- 8 GUI screens implemented: Welcome, Search, Results, Code Preview,
  Indexing, Workspace, History, Settings (+ a secondary Admin Dashboard).
- Demo statistics (mock, matches the project brief): 248 files, 1,842
  functions, 312 classes, 2,104 code chunks, 12.8s indexing time.
- Genuinely working (not mocked): open-file-at-line, workspace detection,
  Top-K + language settings, search-history persistence.
- Explicitly mocked and isolated: `mockSearch()` (keyword-overlap
  ranking) and the indexing progress animation/statistics.
