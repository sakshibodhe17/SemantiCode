// Code-aware tokenizer.
//
// Source code hides words inside identifiers (createAccessToken,
// MAX_UPLOAD_SIZE, verify_password). Plain full-text search treats those
// as single opaque tokens, so a query like "create token" never matches.
// This module splits identifiers into their natural-language parts,
// lowercases them, removes stopwords, and reduces words to a light stem
// so "authenticate", "authentication" and "authenticated" collapse to the
// same term.

const STOPWORDS = new Set([
  // English filler that appears in almost every natural-language query
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "in", "on", "at", "to", "for", "from", "by", "with", "into", "as",
  "and", "or", "but", "not", "no", "if", "then", "else", "this", "that",
  "these", "those", "it", "its", "i", "we", "you", "my", "our", "your",
  "where", "what", "which", "who", "how", "when", "why", "does", "do",
  "did", "done", "can", "could", "should", "would", "will", "shall",
  "there", "here", "some", "any", "all", "each", "every", "about",
  "find", "show", "me", "code", "codes", "logic", "function", "functions",
  "method", "methods", "implemented", "implement", "implementation",
  "handled", "handle", "happens", "located", "defined", "written",
  "responsible", "part", "place", "piece", "used", "using", "use",
  // Ubiquitous language keywords that carry no meaning for ranking
  "self", "def", "return", "const", "let", "var", "public", "private",
  "protected", "static", "void", "new", "import", "export", "package",
  "true", "false", "none", "null", "undefined", "str", "int", "string",
  "number", "bool", "boolean", "async", "await", "elif", "else", "pass",
  "func", "fn", "class", "interface", "type", "struct", "this", "super",
]);

/** Split camelCase / PascalCase / snake_case / kebab-case / digits. */
export function splitIdentifiers(text: string): string[] {
  const spaced = text
    // fooBar -> foo Bar ; HTTPServer -> HTTP Server
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.match(/[A-Za-z]+|\d+/g) ?? [];
}

/**
 * Very small suffix-stripping stemmer (a cut-down Porter step 1 + a few
 * code-specific suffixes). Deliberately conservative: it is better to
 * miss a merge than to collapse unrelated words together.
 */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  const rules: [RegExp, string][] = [
    [/ications?$/, "ic"],
    [/ations?$/, "ate"],
    [/izations?$/, "ize"],
    [/(ss)es$/, "$1"],
    [/ies$/, "y"],
    [/([^s])s$/, "$1"],
    [/eed$/, "ee"],
    [/([a-z]{3,})ing$/, "$1"],
    [/([a-z]{3,})ed$/, "$1"],
    [/([a-z]{3,})er$/, "$1"],
    [/([a-z]{3,})ions?$/, "$1"],
    [/([a-z]{3,})ment$/, "$1"],
    [/([a-z]{3,})ly$/, "$1"],
  ];
  for (const [re, rep] of rules) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      break;
    }
  }
  // authenticate / authentic / authenticat -> authent (applied until stable)
  for (let i = 0; i < 2; i++) {
    const next = w.replace(/(ate|at|ize|iz)$/, "");
    if (next === w || next.length < 3) break;
    w = next;
  }
  // trailing silent e (handle -> handl, so it matches handler -> handl)
  if (w.length > 4) w = w.replace(/e$/, "");
  // doubled consonant left over after stripping (stopp -> stop)
  w = w.replace(/([^aeiouls])\1$/, "$1");
  return w.length >= 2 ? w : word;
}

export interface TokenOptions {
  keepStopwords?: boolean;
}

/** Full pipeline: identifiers -> lowercase words -> filter -> stem. */
export function tokenize(text: string, opts: TokenOptions = {}): string[] {
  const out: string[] = [];
  for (const raw of splitIdentifiers(text)) {
    const word = raw.toLowerCase();
    if (word.length < 2 && !/^\d$/.test(word)) continue;
    if (!opts.keepStopwords && STOPWORDS.has(word)) continue;
    if (/^\d+$/.test(word) && word.length > 4) continue; // drop long numeric literals
    out.push(stem(word));
  }
  return out;
}

/** Lowercased, un-stemmed words (used for display / synonym lookup). */
export function words(text: string): string[] {
  return splitIdentifiers(text)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}
