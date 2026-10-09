// Lightweight multi-language syntax highlighter for the preview pane, plus
// emphasis of the words that made this result match the query.

const KEYWORDS = new Set([
  // Python
  "def", "class", "return", "if", "elif", "else", "try", "except", "finally", "with", "as",
  "import", "from", "raise", "yield", "pass", "None", "True", "False", "and", "or", "not",
  "in", "is", "lambda", "for", "while", "break", "continue", "global", "async", "await",
  // C-family / JS / TS / Java / Go / Rust
  "function", "const", "let", "var", "new", "this", "super", "extends", "implements",
  "interface", "type", "enum", "export", "default", "public", "private", "protected",
  "static", "final", "void", "null", "undefined", "true", "false", "throw", "throws", "catch",
  "switch", "case", "do", "typeof", "instanceof", "package", "func", "struct", "go", "defer",
  "fn", "pub", "impl", "mut", "match", "use", "mod", "fun", "val", "override", "readonly",
  "int", "long", "double", "float", "char", "bool", "boolean", "string", "auto",
]);

const TOKEN_RE =
  /("""[\s\S]*?"""|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\/\/.*$|\/\*.*?\*\/|\b\d+(\.\d+)?\b|[A-Za-z_$][A-Za-z0-9_$]*|\s+|[^\sA-Za-z0-9_$]+)/g;

function makeMatcher(terms: string[]): (tok: string) => boolean {
  const roots = terms
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3)
    .map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
  if (!roots.length) return () => false;
  return (tok) => {
    const lower = tok.toLowerCase();
    return roots.some((r) => lower.includes(r));
  };
}

function highlight(line: string, key: string, hashComments: boolean, isMatch: (t: string) => boolean) {
  const tokens = line.match(TOKEN_RE) ?? [line];
  return (
    <>
      {tokens.map((tok, i) => {
        const k = `${key}-${i}`;
        if ((hashComments && tok.startsWith("#")) || tok.startsWith("//") || tok.startsWith("/*")) {
          return <span key={k} className="tok-comment">{tok}</span>;
        }
        if (/^("""|'''|"|'|`)/.test(tok)) return <span key={k} className="tok-string">{tok}</span>;
        if (/^\d/.test(tok)) return <span key={k} className="tok-number">{tok}</span>;
        const cls = [KEYWORDS.has(tok) ? "tok-keyword" : "", /^[A-Za-z_$]/.test(tok) && isMatch(tok) ? "tok-match" : ""]
          .filter(Boolean)
          .join(" ");
        return cls ? <span key={k} className={cls}>{tok}</span> : <span key={k}>{tok}</span>;
      })}
    </>
  );
}

export function CodeViewer({
  code,
  startLine,
  language = "Python",
  highlightTerms = [],
}: {
  code: string[];
  startLine: number;
  language?: string;
  highlightTerms?: string[];
}) {
  const hashComments = ["Python", "Ruby", "PHP"].includes(language);
  const isMatch = makeMatcher(highlightTerms);
  return (
    <pre className="sc-code">
      <code>
        {code.map((line, i) => {
          const lineNo = startLine + i;
          return (
            <div key={lineNo} className="sc-code__line">
              <span className="sc-code__lineno">{lineNo}</span>
              <span className="sc-code__text">{highlight(line, String(lineNo), hashComments, isMatch)}</span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}
