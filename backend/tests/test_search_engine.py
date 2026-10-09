"""Unit tests for indexing + ranking (no web server needed).

Run from the repository root:  python -m pytest backend/tests -q
"""
from pathlib import Path

from backend.services.indexer import collect_chunks
from backend.services.search_engine import build_search_text, rank, split_identifiers, stem, tokenize

BACKEND = Path(__file__).resolve().parents[1]


def _search(query: str, k: int = 3):
    _, chunks = collect_chunks(str(BACKEND))
    docs = [build_search_text(c["name"], c.get("class_name"), c["file"], c.get("doc", ""), c["content"]) for c in chunks]
    meta = [{"language": c["language"], "file": c["file"], "kind": c["type"]} for c in chunks]
    return [(chunks[r.index], r) for r in rank(query, docs, meta, k)]


def test_identifier_splitting():
    assert split_identifiers("createAccessToken") == ["create", "Access", "Token"]
    assert tokenize("verify_password HTTPServer") == ["verify", "password", "http", "serv"]


def test_stemming_merges_word_forms():
    assert stem("authentication") == stem("authenticate") == stem("authenticated")
    assert stem("handler") == stem("handle")
    assert stem("uploads") == stem("upload")


def test_python_ast_chunks_have_exact_lines_and_classes():
    _, chunks = collect_chunks(str(BACKEND))
    by_name = {c["name"]: c for c in chunks}
    assert by_name["authenticate_user"]["type"] == "function"
    assert by_name["get_by_username"]["type"] == "method"
    assert by_name["get_by_username"]["class_name"] == "UserRepository"
    assert by_name["User"]["type"] == "class"


def test_jwt_query_finds_token_creation():
    top = _search("in:auth Where is the JWT token generated?")
    assert top[0][0]["name"] == "create_access_token"


def test_concept_expansion_bridges_vocabulary():
    # "login" never appears in verify_password, but auth/password concepts do
    names = [c["name"] for c, _ in _search("how is login checked", 5)]
    assert any(n in names for n in ("authenticate_user", "login", "verify_password"))


def test_filters():
    results = _search("lang:python kind:class user", 5)
    assert results and all(c["type"] == "class" for c, _ in results)


def test_scores_are_monotonic_percentages():
    scores = [r.relevance for _, r in _search("database connection", 5)]
    assert all(0 < s <= 100 for s in scores)
    assert scores == sorted(scores, reverse=True)
