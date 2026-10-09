// Code-concept thesaurus used for query expansion.
//
// Developers describe behaviour in English ("where do we log the user
// in?") while code uses jargon and abbreviations (authenticate, jwt,
// bcrypt, sess). Each group below is one *concept*; when a query word
// belongs to a group, the other members are added to the query with a
// lower weight. This is the lightweight, offline "semantic" layer: it
// bridges vocabulary mismatch without needing a neural model, and it is
// fully explainable (you can point at the exact group that matched).

import { stem } from "./tokenizer";

const CONCEPT_GROUPS: string[][] = [
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
];

/** stemmed term -> set of stemmed related terms (excluding itself) */
const RELATED = new Map<string, Set<string>>();

for (const group of CONCEPT_GROUPS) {
  const stems = Array.from(new Set(group.map((w) => stem(w.toLowerCase()))));
  for (const s of stems) {
    let set = RELATED.get(s);
    if (!set) {
      set = new Set();
      RELATED.set(s, set);
    }
    for (const other of stems) if (other !== s) set.add(other);
  }
}

/** Related concept terms for a (stemmed) query term. */
export function relatedTerms(stemmedTerm: string): string[] {
  return Array.from(RELATED.get(stemmedTerm) ?? []);
}

export const conceptGroupCount = CONCEPT_GROUPS.length;
