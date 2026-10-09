"""Ranking for the FastAPI backend: BM25F + code-aware concept expansion.

This mirrors the VS Code extension's local engine
(frontend/extension/src/engine/*.ts) so both engines rank the same way:

1. ``tokenize`` splits identifiers (createAccessToken -> create access token),
   lower-cases, drops stopwords and applies a light stemmer.
2. ``expand`` adds related programming concepts (login <-> auth <-> jwt ...)
   with a lower weight -- an offline, explainable "semantic" layer.
3. ``rank`` scores every chunk with BM25 over a field-weighted bag of words
   (symbol name x4, class x2, docstring x2, path x1, body x1) and multiplies
   by *coverage*: the share of query concepts the chunk actually contains.

The CONCEPT_GROUPS list is duplicated from synonyms.ts on purpose so the
backend has no dependency on the frontend folder.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

K1, B = 1.2, 0.75
SYNONYM_WEIGHT, PREFIX_WEIGHT = 0.4, 0.6
FIELD_REPEAT = {"name": 4, "class_name": 2, "doc": 2, "path": 1, "body": 1}

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "of", "in", "on", "at", "to", "for", "from", "by", "with", "into",
    "as", "and", "or", "but", "not", "no", "if", "then", "else", "this",
    "that", "these", "those", "it", "its", "i", "we", "you", "my", "our",
    "your", "where", "what", "which", "who", "how", "when", "why", "does", "do",
    "did", "done", "can", "could", "should", "would", "will", "shall", "there", "here",
    "some", "any", "all", "each", "every", "about", "find", "show", "me", "code",
    "codes", "logic", "function", "functions", "method", "methods", "implemented", "implement", "implementation", "handled",
    "handle", "happens", "located", "defined", "written", "responsible", "part", "place", "piece", "used",
    "using", "use", "self", "def", "return", "const", "let", "var", "public", "private",
    "protected", "static", "void", "new", "import", "export", "package", "true", "false", "none",
    "null", "undefined", "str", "int", "string", "number", "bool", "boolean", "async", "await",
    "elif", "else", "pass", "func", "fn", "class", "interface", "type", "struct", "this",
    "super"
}

CONCEPT_GROUPS = [
    ["auth", "authenticate", "authentication", "login", "logon", "signin", "sign", "credential", "credentials", "password", "passwd", "session", "logout", "oauth", "sso"],
    ["jwt", "token", "bearer", "claims", "access", "refresh", "jws", "signature"],
    ["authorize", "authorization", "permission", "role", "roles", "acl", "rbac", "admin", "privilege", "policy", "guard"],
    ["hash", "bcrypt", "argon", "scrypt", "salt", "digest", "sha", "md5", "crypto", "encrypt", "decrypt", "cipher"],
    ["user", "users", "account", "member", "profile", "customer", "person", "owner"],
    ["register", "registration", "signup", "onboard", "enroll"],
    ["database", "db", "sql", "sqlite", "postgres", "postgresql", "mysql", "mongo", "orm", "sqlalchemy", "prisma", "sequelize", "repository", "repo", "dao", "table", "schema", "migration"],
    ["connection", "connect", "engine", "pool", "client", "driver", "dsn", "socket"],
    ["query", "select", "filter", "where", "lookup", "fetch", "retrieve", "get", "read", "load", "find"],
    ["insert", "create", "add", "save", "store", "persist", "put", "write", "new", "make"],
    ["generate", "create", "issue", "build", "produce", "make", "encode", "sign", "mint", "factory"],
    ["update", "modify", "edit", "patch", "change", "set", "upsert"],
    ["delete", "remove", "destroy", "drop", "unlink", "erase", "purge", "clear"],
    ["upload", "uploads", "file", "files", "attachment", "multipart", "blob", "storage", "bucket", "s3"],
    ["download", "export", "stream"],
    ["validate", "validation", "validator", "check", "verify", "sanitize", "assert", "ensure", "constraint"],
    ["error", "errors", "exception", "raise", "throw", "fail", "failure", "catch", "except", "panic", "fault"],
    ["log", "logger", "logging", "trace", "debug", "audit", "record", "monitor"],
    ["config", "configuration", "settings", "setting", "env", "environment", "option", "options", "dotenv", "preference"],
    ["http", "request", "response", "route", "router", "routes", "endpoint", "api", "handler", "controller", "view", "rest", "url", "path", "get", "post"],
    ["middleware", "interceptor", "filter", "hook", "pipe"],
    ["cache", "caching", "memo", "memoize", "redis", "ttl"],
    ["time", "date", "datetime", "timestamp", "expire", "expiry", "expiration", "timeout", "duration", "clock"],
    ["email", "mail", "smtp", "notify", "notification", "message", "send"],
    ["payment", "pay", "billing", "invoice", "charge", "checkout", "stripe", "order", "price"],
    ["test", "tests", "spec", "mock", "fixture", "assert", "unittest", "pytest", "jest"],
    ["parse", "parser", "parsing", "ast", "tokenize", "tokenizer", "lexer", "syntax", "grammar"],
    ["search", "index", "indexing", "rank", "ranking", "score", "similarity", "embedding", "vector", "retrieve"],
    ["render", "component", "ui", "view", "template", "page", "screen", "widget", "jsx", "html", "css", "style"],
    ["state", "store", "reducer", "context", "redux", "signal"],
    ["convert", "transform", "serialize", "deserialize", "encode", "decode", "json", "marshal", "format"],
    ["start", "init", "initialize", "setup", "bootstrap", "main", "startup", "launch", "lifespan"],
    ["stop", "shutdown", "close", "dispose", "teardown", "cleanup", "exit"],
    ["thread", "async", "concurrent", "parallel", "worker", "queue", "job", "task", "schedule", "cron"],
    ["size", "limit", "max", "maximum", "min", "minimum", "quota", "threshold", "length"],
    ["sort", "order", "rank", "compare"],
    ["image", "picture", "avatar", "photo", "png", "jpg", "jpeg", "thumbnail"],
    ["network", "fetch", "axios", "requests", "httpx", "socket", "websocket", "client"],
    ["security", "secure", "csrf", "xss", "cors", "secret", "key", "vulnerability", "traversal"],
]


def split_identifiers(text: str) -> list[str]:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    spaced = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", spaced)
    return re.findall(r"[A-Za-z]+|\d+", spaced)


_RULES = [
    (r"ications?$", "ic"), (r"ations?$", "ate"), (r"izations?$", "ize"), (r"(ss)es$", r"\1"),
    (r"ies$", "y"), (r"([^s])s$", r"\1"), (r"eed$", "ee"), (r"([a-z]{3,})ing$", r"\1"),
    (r"([a-z]{3,})ed$", r"\1"), (r"([a-z]{3,})er$", r"\1"), (r"([a-z]{3,})ions?$", r"\1"),
    (r"([a-z]{3,})ment$", r"\1"), (r"([a-z]{3,})ly$", r"\1"),
]


def stem(word: str) -> str:
    """Conservative suffix stripper; identical rules to tokenizer.ts."""
    w = word
    if len(w) <= 3:
        return w
    for pattern, rep in _RULES:
        if re.search(pattern, w):
            w = re.sub(pattern, rep, w, count=1)
            break
    for _ in range(2):
        nxt = re.sub(r"(ate|at|ize|iz)$", "", w)
        if nxt == w or len(nxt) < 3:
            break
        w = nxt
    if len(w) > 4:
        w = re.sub(r"e$", "", w)
    w = re.sub(r"([^aeiouls])\1$", r"\1", w)
    return w if len(w) >= 2 else word


def tokenize(text: str) -> list[str]:
    out = []
    for raw in split_identifiers(text):
        word = raw.lower()
        if (len(word) < 2 and not word.isdigit()) or word in STOPWORDS:
            continue
        if word.isdigit() and len(word) > 4:
            continue
        out.append(stem(word))
    return out


RELATED: dict[str, set[str]] = {}
SURFACE: dict[str, str] = {}  # stem -> readable word, for "matched" labels
for _group in CONCEPT_GROUPS:
    for _w in _group:
        SURFACE.setdefault(stem(_w), _w)
    _stems = {stem(w) for w in _group}
    for _s in _stems:
        RELATED.setdefault(_s, set()).update(_stems - {_s})


def build_search_text(name: str, class_name: str | None, path: str, doc: str, body: str) -> str:
    """Field-weighted token string stored in code_chunks.search_text."""
    parts: list[str] = []
    parts += tokenize(name) * FIELD_REPEAT["name"]
    if class_name:
        parts += tokenize(class_name) * FIELD_REPEAT["class_name"]
    parts += tokenize(re.sub(r"\.[^./]+$", "", path)) * FIELD_REPEAT["path"]
    if doc:
        parts += tokenize(doc) * FIELD_REPEAT["doc"]
    parts += tokenize(body)
    return " ".join(parts)


@dataclass
class Ranked:
    index: int
    score: float
    relevance: float
    matched: list[dict] = field(default_factory=list)


def parse_filters(query: str) -> tuple[str, dict]:
    filters: dict[str, str] = {}

    def grab(m: re.Match) -> str:
        filters[m.group(1).lower()] = m.group(2).strip('"').lower()
        return " "

    text = re.sub(r"\b(lang|in|kind):(\"[^\"]+\"|\S+)", grab, query, flags=re.I)
    return text.strip(), filters


_LANG_ALIASES = {"py": "python", "js": "javascript", "ts": "typescript", "cpp": "c++", "golang": "go", "cs": "c#"}
_KIND_ALIASES = {"classes": "class", "functions": "function", "methods": "method", "blocks": "block"}


def _passes_filters(m: dict, filters: dict) -> bool:
    if "lang" in filters and m.get("language", "").lower() != _LANG_ALIASES.get(filters["lang"], filters["lang"]):
        return False
    if "in" in filters and filters["in"].replace("\\", "/") not in m.get("file", "").lower():
        return False
    if "kind" in filters:
        k = _KIND_ALIASES.get(filters["kind"], filters["kind"])
        kind = m.get("kind", "")
        if k == "function":
            return kind in ("function", "method")
        return kind == k
    return True


def rank(query: str, docs: list[str], meta: list[dict], top_k: int, expand: bool = True) -> list[Ranked]:
    """Rank documents (search_text strings) for a query. ``meta`` items need
    ``language``, ``file`` and ``kind`` keys for filters."""
    text, filters = parse_filters(query)
    base = list(dict.fromkeys(tokenize(text)))
    if not base or not docs:
        return []
    tfs = []
    df: dict[str, int] = {}
    for d in docs:
        tf: dict[str, int] = {}
        for t in d.split():
            tf[t] = tf.get(t, 0) + 1
        tfs.append(tf)
        for t in tf:
            df[t] = df.get(t, 0) + 1
    lengths = [max(len(d.split()), 1) for d in docs]
    avg = sum(lengths) / len(lengths)
    n = len(docs)
    words = {stem(w.lower()): w.lower() for w in split_identifiers(text)}

    expansions: dict[str, list[tuple[str, float, str]]] = {}
    vocab = list(df)
    for q in base:
        lst = []
        if q in df:
            lst.append((q, 1.0, "exact"))
        if len(q) >= 4:
            lst += [(v, PREFIX_WEIGHT, "prefix") for v in vocab if len(v) >= len(q) + 3 and v.startswith(q)][:8]
        if expand:
            lst += [(r, SYNONYM_WEIGHT, "concept") for r in RELATED.get(q, ()) if r in df and r != q]
        expansions[q] = lst

    scores: dict[int, float] = {}
    covered: dict[int, dict[str, dict]] = {}
    for q, lst in expansions.items():
        best: dict[int, tuple[float, dict]] = {}
        for term, weight, via in lst:
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            for i, tf in enumerate(tfs):
                f = tf.get(term)
                if not f:
                    continue
                s = weight * idf * f * (K1 + 1) / (f + K1 * (1 - B + B * lengths[i] / avg))
                if i not in best or s > best[i][0]:
                    best[i] = (s, {"term": words.get(term, term) if via == "exact" else SURFACE.get(term, term), "via": via})
        for i, (s, m) in best.items():
            scores[i] = scores.get(i, 0.0) + s
            covered.setdefault(i, {})[q] = m

    results: list[Ranked] = []
    for i, raw in scores.items():
        m = meta[i]
        if not _passes_filters(meta[i], filters):
            continue
        cov_items = covered[i].values()
        coverage = sum(1.0 if c["via"] == "exact" else 0.8 if c["via"] == "prefix" else 0.6 for c in cov_items) / len(base)
        prior = 0.75 if m.get("kind") == "block" else 0.9 if m.get("kind") == "class" else 1.0
        results.append(Ranked(i, raw * (0.4 + 0.6 * coverage) * prior, coverage, list(cov_items)))

    results.sort(key=lambda r: r.score, reverse=True)
    top = results[:max(1, top_k)]
    best_score = top[0].score if top else 1.0
    ceiling = 99.4
    for r in top:
        ceiling = min(ceiling, 100 * (0.6 * r.relevance + 0.4 * r.score / best_score))
        r.relevance = round(ceiling, 2)
    return top
