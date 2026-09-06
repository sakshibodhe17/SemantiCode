# demo-project (demo codebase)

This is a small sample codebase used **only** to demonstrate the SemantiCode
IDE extension during Evaluation 2. It is not part of the actual Semantic
Code Search Engine implementation — it plays the role of "some developer's
project" that a user of the extension would have open in VS Code.

Open **this folder** (`demo-project`) as your VS Code workspace when running
the extension (see the root-level `README.md` for the exact F5 debug
instructions). The extension's search results, "Open in Editor" links, and
line numbers in the mock data are all written to point at real files in
this folder, so the demo genuinely opens the correct file and line — only
the *ranking/similarity scores* are mocked, not the file navigation.
