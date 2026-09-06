// Small hand-rolled Python-ish syntax highlighter. Deliberately simple —
// this is a GUI-design milestone, not a language server. Good enough to
// make the code preview look like a real editor pane at a glance.

const KEYWORDS = new Set([
  "def", "class", "return", "if", "elif", "else", "try", "except",
  "finally", "with", "as", "import", "from", "raise", "yield", "pass",
  "None", "True", "False", "and", "or", "not", "in", "is", "lambda",
  "for", "while", "break", "continue", "global", "async", "await",
]);

const TOKEN_RE = /("""[\s\S]*?"""|"[^"]*"|'[^']*'|#.*$|\b\d+(\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*|\s+|[^\sA-Za-z0-9_]+)/g;

function highlight(line: string, key: string) {
  const tokens = line.match(TOKEN_RE) ?? [line];
  return (
    <>
      {tokens.map((tok, i) => {
        const tokenKey = `${key}-${i}`;
        if (tok.startsWith("#")) {
          return (
            <span key={tokenKey} className="tok-comment">
              {tok}
            </span>
          );
        }
        if (/^("""|'''|"|')/.test(tok)) {
          return (
            <span key={tokenKey} className="tok-string">
              {tok}
            </span>
          );
        }
        if (/^\d/.test(tok)) {
          return (
            <span key={tokenKey} className="tok-number">
              {tok}
            </span>
          );
        }
        if (KEYWORDS.has(tok)) {
          return (
            <span key={tokenKey} className="tok-keyword">
              {tok}
            </span>
          );
        }
        return <span key={tokenKey}>{tok}</span>;
      })}
    </>
  );
}

export function CodeViewer({
  code,
  startLine,
  highlightRange,
}: {
  code: string[];
  startLine: number;
  /** 0-based [start, end) range of lines (within `code`) to emphasize. */
  highlightRange?: [number, number];
}) {
  return (
    <pre className="sc-code">
      <code>
        {code.map((line, i) => {
          const lineNo = startLine + i;
          const emphasized =
            highlightRange && i >= highlightRange[0] && i < highlightRange[1];
          return (
            <div
              key={lineNo}
              className={`sc-code__line ${emphasized ? "is-emphasized" : ""}`}
            >
              <span className="sc-code__lineno">{lineNo}</span>
              <span className="sc-code__text">{highlight(line, String(lineNo))}</span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}
