"""Source-code indexing: walk a folder and split files into searchable units.

* Python files are parsed with the standard-library ``ast`` module, so every
  function, async function, method and class becomes its own chunk with exact
  start/end lines, its parent class and its docstring.
* C-family files (JS/TS/Java/Go/C/C++/C#/PHP/Rust/Kotlin) use a declaration
  regex plus brace matching -- the same strategy as the VS Code extension.
* Anything else (or a file with no symbols) is split into 40-line windows.

Everything is deterministic and offline, so the demo needs no ML downloads.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

SOURCE_SUFFIXES = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript", ".java": "Java", ".go": "Go",
    ".c": "C", ".h": "C", ".cpp": "C++", ".cc": "C++", ".hpp": "C++",
    ".cs": "C#", ".php": "PHP", ".rs": "Rust", ".kt": "Kotlin",
}
IGNORED_DIRS = {".git", ".venv", "venv", "env", "node_modules", "dist", "out", "build",
                "__pycache__", ".next", "target", "coverage", "vendor"}
MAX_FILE_BYTES = 512 * 1024
MAX_FILES = 5000
WINDOW = 40
PREVIEW_LINES = 120


def tokens(text: str) -> str:
    """Split identifiers like createAccessToken / verify_password into words.

    Kept for backwards compatibility; ranking now uses search_engine.tokenize.
    """
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    return " ".join(re.findall(r"[A-Za-z]+|\d+", spaced)).lower()


def _chunk(file: str, language: str, lines: list[str], name: str, kind: str,
           class_name: str | None, start: int, end: int, doc: str = "") -> dict:
    """Build one chunk dict. ``start``/``end`` are 1-based inclusive."""
    snippet = lines[start - 1:min(end, start - 1 + PREVIEW_LINES)]
    return {
        "file": file, "name": name, "type": kind, "class_name": class_name,
        "language": language, "start": start, "end": end, "doc": doc.strip(),
        "content": "\n".join(snippet),
    }


# --------------------------------------------------------------------- Python

def python_chunks(path: Path, root: Path) -> list[dict]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    lines = content.splitlines()
    rel = path.relative_to(root).as_posix()
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return window_chunks(rel, "Python", lines)

    chunks: list[dict] = []
    covered: set[int] = set()

    def visit(node: ast.AST, parent_class: str | None) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                start = min([d.lineno for d in getattr(child, "decorator_list", [])] + [child.lineno])
                end = getattr(child, "end_lineno", child.lineno) or child.lineno
                doc = ast.get_docstring(child) or ""
                if isinstance(child, ast.ClassDef):
                    chunks.append(_chunk(rel, "Python", lines, child.name, "class", None, start, end, doc))
                    visit(child, child.name)
                else:
                    kind = "method" if parent_class else "function"
                    chunks.append(_chunk(rel, "Python", lines, child.name, kind, parent_class, start, end, doc))
                    visit(child, parent_class)
                if parent_class is None:
                    covered.update(range(start, end + 1))
            else:
                visit(child, parent_class)

    visit(tree, None)
    chunks.extend(_module_scope(rel, "Python", lines, covered))
    return chunks or window_chunks(rel, "Python", lines)


def _module_scope(rel: str, language: str, lines: list[str], covered: set[int]) -> list[dict]:
    """Top-level statements outside functions/classes (e.g. engine = create_engine(...))."""
    out: list[dict] = []
    trivial = re.compile(r"^\s*($|#|//|import\b|from\s+\S+\s+import\b|package\b|using\b|[})\]])")
    i, n = 1, len(lines)
    base = rel.rsplit("/", 1)[-1]
    while i <= n:
        if i in covered:
            i += 1
            continue
        j = i
        while j <= n and j not in covered and j - i < WINDOW:
            j += 1
        block = lines[i - 1:j - 1]
        if any(not trivial.match(line) for line in block):
            s, e = i, j - 1
            while s < e and not lines[s - 1].strip():
                s += 1
            while e > s and not lines[e - 1].strip():
                e -= 1
            out.append(_chunk(rel, language, lines, f"{base} (module scope)", "block", None, s, e))
        i = j
    return out


# ------------------------------------------------------------------ C-family

_DECLS = [
    (re.compile(r"^(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|abstract\s+|final\s+|static\s+|sealed\s+|partial\s+|data\s+|open\s+)*(?:class|interface|struct|enum|trait|impl|object|record)\s+([A-Za-z_$][\w$]*)"), "class"),
    (re.compile(r"^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b"), "class"),
    (re.compile(r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[<(]"), "function"),
    (re.compile(r"^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*[(\[]"), "function"),
    (re.compile(r"^(?:pub(?:\([^)]*\))?\s+)?(?:public\s+|private\s+|protected\s+|static\s+|async\s+|override\s+|suspend\s+)*(?:fn|fun|function)\s+([A-Za-z_]\w*)\s*[<(]"), "function"),
    (re.compile(r"^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)"), "function"),
    (re.compile(r"^(?:[\w$<>\[\],.?*&:\s@]+\s+)?[*&]?([A-Za-z_$~][\w$]*)\s*\([^;]*$"), "function"),
]
_RESERVED = {"if", "for", "while", "switch", "catch", "return", "else", "do", "try", "new",
             "typeof", "sizeof", "function", "await", "throw", "case", "with", "foreach",
             "using", "lock", "synchronized", "match", "loop"}


def _declaration(line: str) -> tuple[str, str] | None:
    t = line.strip()
    if not t or t.startswith(("//", "*", "/*", "#")):
        return None
    for regex, kind in _DECLS:
        m = regex.match(t)
        if not m or m.group(1) in _RESERVED:
            continue
        if regex is _DECLS[-1][0]:
            args = t[t.find("(") + 1:]
            if re.search(r"[\"'`]|=>|\bfunction\b", args) or re.search(r"[=;,]\s*$", t) \
                    or re.match(r"^(return|else|new|await|throw|yield|delete)\b", t):
                return None
        return m.group(1), kind
    return None


def _block_end(lines: list[str], start: int) -> int:
    """0-based index of the line with the matching closing brace, or -1."""
    depth, parens, opened = 0, 0, False
    for i in range(start, min(len(lines), start + 2000)):
        code = re.sub(r"//.*$", "", re.sub(r"(\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*')", "\"\"", lines[i]))
        for ch in code:
            if ch == "(":
                parens += 1
            elif ch == ")":
                parens = max(0, parens - 1)
            elif parens and not opened:
                continue  # braces in a parameter list (defaults/destructuring)
            elif ch == "{":
                depth += 1
                opened = True
            elif ch == "}":
                depth -= 1
                if opened and depth <= 0:
                    return i
            elif ch == ";" and not opened and depth == 0:
                return -1
        if not opened and i - start > 6:
            return -1
    return -1


def _leading_comment(lines: list[str], index: int) -> str:
    out: list[str] = []
    i = index - 1
    while i >= 0:
        t = lines[i].strip()
        if t.startswith("@"):
            i -= 1
            continue
        if t.startswith(("//", "/*", "*")):
            out.insert(0, re.sub(r"^(///?|/\*\*?|\*/?)\s?", "", t).removesuffix("*/").strip())
            i -= 1
            continue
        break
    return " ".join(out)


def brace_chunks(path: Path, root: Path, language: str) -> list[dict]:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    rel = path.relative_to(root).as_posix()
    chunks: list[dict] = []
    covered: set[int] = set()
    classes: list[tuple[str, int]] = []
    i = 0
    while i < len(lines):
        decl = _declaration(lines[i])
        end = _block_end(lines, i) if decl else -1
        if decl and end >= 0:
            name, kind = decl
            while classes and classes[-1][1] < i:
                classes.pop()
            parent = classes[-1][0] if classes else None
            doc = _leading_comment(lines, i)
            if kind == "class":
                chunks.append(_chunk(rel, language, lines, name, "class", None, i + 1, end + 1, doc))
                classes.append((name, end))
            else:
                chunks.append(_chunk(rel, language, lines, name, "method" if parent else "function",
                                     parent, i + 1, end + 1, doc))
            if not parent:
                covered.update(range(i + 1, end + 2))
            if kind != "class" and not parent:
                i = end
        i += 1
    if not chunks:
        return window_chunks(rel, language, lines)
    return chunks + _module_scope(rel, language, lines, covered)


def window_chunks(rel: str, language: str, lines: list[str]) -> list[dict]:
    base = rel.rsplit("/", 1)[-1]
    out = []
    for s in range(0, len(lines), WINDOW):
        e = min(len(lines), s + WINDOW)
        if any(line.strip() for line in lines[s:e]):
            name = base if len(lines) <= WINDOW else f"{base} [{s + 1}-{e}]"
            out.append(_chunk(rel, language, lines, name, "block", None, s + 1, e))
    return out


# --------------------------------------------------------------------- walker

def collect_chunks(root_path: str) -> tuple[int, list[dict]]:
    """Return (number_of_files, chunks) for every supported file under root_path."""
    root = Path(root_path).expanduser().resolve()
    if not root.is_dir():
        raise ValueError("path must be an existing directory")
    chunks: list[dict] = []
    file_count = 0
    for path in sorted(root.rglob("*")):
        rel_parts = path.relative_to(root).parts
        if any(part in IGNORED_DIRS for part in rel_parts):
            continue
        language = SOURCE_SUFFIXES.get(path.suffix.lower())
        if not language or not path.is_file():
            continue
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        file_count += 1
        if file_count > MAX_FILES:
            break
        if language == "Python":
            chunks.extend(python_chunks(path, root))
        else:
            chunks.extend(brace_chunks(path, root, language))
    return min(file_count, MAX_FILES), chunks
