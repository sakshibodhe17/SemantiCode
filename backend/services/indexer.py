"""Safe local source-code indexing using Python's AST module.

Each Python function and class becomes an independently searchable chunk.
Other text source files are stored as a single chunk.  This is intentionally
deterministic and offline, making it appropriate for the local demo.
"""
import ast
import re
from pathlib import Path

SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".c", ".cpp", ".h"}
IGNORED_DIRS = {".git", ".venv", "node_modules", "dist", "__pycache__"}


def tokens(text: str) -> str:
    """Split identifiers like createAccessToken into useful search terms."""
    return " ".join(re.findall(r"[A-Za-z]+|\d+", re.sub(r"([a-z])([A-Z])", r"\1 \2", text))).lower()


def python_chunks(path: Path, root: Path):
    content = path.read_text(encoding="utf-8", errors="ignore")
    lines = content.splitlines()
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return []
    chunks = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        start, end = node.lineno, getattr(node, "end_lineno", node.lineno)
        snippet = "\n".join(lines[start - 1:end])
        kind = "class" if isinstance(node, ast.ClassDef) else "function"
        chunks.append({"file": str(path.relative_to(root)).replace("\\", "/"), "name": node.name,
                       "type": kind, "start": start, "end": end, "content": snippet,
                       "search_text": tokens(f"{node.name} {path.name} {snippet}" )})
    return chunks


def collect_chunks(root_path: str):
    root = Path(root_path).resolve()
    if not root.is_dir():
        raise ValueError("path must be an existing directory")
    chunks, file_count = [], 0
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES or any(part in IGNORED_DIRS for part in path.parts):
            continue
        file_count += 1
        if path.suffix.lower() == ".py":
            chunks.extend(python_chunks(path, root))
        else:
            content = path.read_text(encoding="utf-8", errors="ignore")
            chunks.append({"file": str(path.relative_to(root)).replace("\\", "/"), "name": path.stem,
                           "type": "file", "start": 1, "end": min(len(content.splitlines()), 200),
                           "content": content[:12000], "search_text": tokens(f"{path.name} {content}")})
    return file_count, chunks
