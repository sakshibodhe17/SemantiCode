// Structural chunker: turns a source file into searchable "code units".
//
// Searching whole files is too coarse (a 600-line file matches almost
// anything) and searching single lines loses context. The useful unit is
// a function, method or class, so this module finds those boundaries:
//
//   * Python            -> indentation based (def / async def / class)
//   * C-family languages -> declaration regex + brace matching
//                           (JS, TS, Java, Go, C, C++, C#, PHP, Rust, Kotlin)
//   * Anything else, or a file with no symbols -> fixed line windows
//
// The leading comment / docstring is captured separately because it is
// the closest thing to an English description of what the code does,
// and it is weighted higher during ranking.

export type ChunkKind = "function" | "method" | "class" | "block";

export interface CodeChunk {
  id: string;
  file: string; // workspace-relative path, forward slashes
  name: string;
  kind: ChunkKind;
  className: string | null;
  language: string;
  startLine: number; // 1-based inclusive
  endLine: number; // 1-based inclusive
  doc: string; // leading comment / docstring text
  signature: string; // first line of the declaration
  code: string[]; // source lines (truncated for preview)
}

export const MAX_PREVIEW_LINES = 120;
const WINDOW = 40;

export const EXTENSION_LANGUAGE: Record<string, string> = {
  py: "Python",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  java: "Java",
  c: "C", h: "C",
  cc: "C++", cpp: "C++", cxx: "C++", hpp: "C++", hh: "C++", hxx: "C++",
  go: "Go",
  cs: "C#",
  php: "PHP",
  rs: "Rust",
  kt: "Kotlin", kts: "Kotlin",
  rb: "Ruby",
};

export function languageOf(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_LANGUAGE[ext] ?? null;
}

export function chunkFile(file: string, content: string): CodeChunk[] {
  const language = languageOf(file) ?? "Text";
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let chunks: CodeChunk[];
  if (language === "Python") chunks = pythonChunks(file, lines);
  else if (language === "Ruby") chunks = rubyChunks(file, lines);
  else chunks = braceChunks(file, lines, language);

  if (chunks.length === 0) return windowChunks(file, lines, language);
  return chunks.concat(moduleScopeChunks(file, lines, language, chunks));
}

/**
 * Top-level statements that live outside every function/class (e.g.
 * `engine = create_engine(DATABASE_URL)`, route registration, constants)
 * are often exactly what a developer is looking for, so they are indexed
 * as "module scope" blocks instead of being silently dropped.
 */
function moduleScopeChunks(file: string, lines: string[], language: string, symbols: CodeChunk[]): CodeChunk[] {
  const covered = new Uint8Array(lines.length);
  for (const c of symbols) for (let i = c.startLine - 1; i < c.endLine; i++) covered[i] = 1;
  const base = file.split("/").pop() ?? file;
  const out: CodeChunk[] = [];
  const trivial = (l: string) => {
    const t = l.trim();
    return t === "" || /^(#|\/\/|\/\*|\*|import\b|from\s+\S+\s+import\b|package\b|using\b|#include\b|"use strict"|\}|\)|\]|@)/.test(t)
      || /^(?:const|let|var)\s+.*=\s*require\(/.test(t) || /^export\s+\{/.test(t);
  };
  let i = 0;
  while (i < lines.length) {
    if (covered[i]) { i++; continue; }
    let j = i;
    while (j < lines.length && !covered[j] && j - i < WINDOW) j++;
    const slice = lines.slice(i, j);
    const meaningful = slice.filter((l) => !trivial(l)).length;
    if (meaningful >= 1) {
      // trim leading/trailing blank lines so the range is tight
      let s = i, e = j - 1;
      while (s < e && lines[s].trim() === "") s++;
      while (e > s && lines[e].trim() === "") e--;
      out.push(makeChunk(file, language, lines, `${base} (module scope)`, "block", null, s, e, leadingComment(lines, s, ["Python", "Ruby", "PHP"].includes(language))));
    }
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------- helpers

function makeChunk(
  file: string,
  language: string,
  lines: string[],
  name: string,
  kind: ChunkKind,
  className: string | null,
  start: number, // 0-based
  end: number, // 0-based inclusive
  doc: string
): CodeChunk {
  const code = lines.slice(start, Math.min(end + 1, start + MAX_PREVIEW_LINES));
  return {
    id: `${file}#${start + 1}-${name}`,
    file,
    name,
    kind,
    className,
    language,
    startLine: start + 1,
    endLine: end + 1,
    doc: doc.trim(),
    signature: lines[start].trim().slice(0, 200),
    code,
  };
}

function indentOf(line: string): number {
  const m = /^[ \t]*/.exec(line);
  return m ? m[0].replace(/\t/g, "    ").length : 0;
}

/** Comment lines directly above `index` (JSDoc, //, #, decorators skipped). */
function leadingComment(lines: string[], index: number, hashComments = true): string {
  const collected: string[] = [];
  let i = index - 1;
  while (i >= 0) {
    const t = lines[i].trim();
    if (t.startsWith("@") && !t.startsWith("@param") && !t.startsWith("@return")) {
      i--; // decorator / annotation — skip but keep walking up
      continue;
    }
    if (/^(\/\/|\*|\/\*\*?|\*\/|\/\/\/)/.test(t) || (hashComments && t.startsWith("#"))) {
      collected.unshift(t.replace(/^(\/\/\/?|#|\/\*\*?|\*\/|\*)\s?/, "").replace(/\s*\*\/\s*$/, ""));
      i--;
      continue;
    }
    break;
  }
  return collected.join(" ");
}

// ---------------------------------------------------------------- Python

const PY_DEF = /^([ \t]*)(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)/;
const PY_CLASS = /^([ \t]*)class[ \t]+([A-Za-z_]\w*)/;

function pythonChunks(file: string, lines: string[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const classStack: { name: string; indent: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const def = PY_DEF.exec(line);
    const cls = def ? null : PY_CLASS.exec(line);
    if (!def && !cls) continue;

    const indent = indentOf((def ?? cls)![1]);
    while (classStack.length && classStack[classStack.length - 1].indent >= indent) classStack.pop();

    // Body ends before the next non-blank, non-comment line with indent <= ours.
    let end = i;
    let j = i + 1;
    // multi-line signature: continue until a line ending with ':'
    while (j < lines.length && !/:\s*(#.*)?$/.test(lines[j - 1]) && j - i < 12) j++;
    for (; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === "" || t.startsWith("#")) continue;
      if (indentOf(lines[j]) <= indent) break;
      end = j;
    }
    end = Math.max(end, i);

    const doc = pythonDocstring(lines, i, end) || leadingComment(lines, i);
    const parent = classStack.length ? classStack[classStack.length - 1].name : null;

    if (cls) {
      chunks.push(makeChunk(file, "Python", lines, cls[2], "class", null, i, end, doc));
      classStack.push({ name: cls[2], indent });
    } else {
      chunks.push(
        makeChunk(file, "Python", lines, def![2], parent ? "method" : "function", parent, i, end, doc)
      );
    }
  }
  return chunks;
}

function pythonDocstring(lines: string[], start: number, end: number): string {
  for (let k = start + 1; k <= Math.min(end, start + 12); k++) {
    const t = lines[k].trim();
    if (t === "") continue;
    const m = /^[rubRUB]?("""|''')/.exec(t);
    if (!m) {
      if (/:\s*$/.test(lines[k - 1]) || k === start + 1) return "";
      continue;
    }
    const quote = m[1];
    const rest = t.slice(m[0].length);
    if (rest.includes(quote)) return rest.slice(0, rest.indexOf(quote));
    const parts = [rest];
    for (let q = k + 1; q <= end; q++) {
      const l = lines[q];
      if (l.includes(quote)) {
        parts.push(l.slice(0, l.indexOf(quote)));
        break;
      }
      parts.push(l.trim());
    }
    return parts.join(" ");
  }
  return "";
}

// ---------------------------------------------------------------- Ruby

function rubyChunks(file: string, lines: string[]): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const re = /^(\s*)(def|class|module)\s+([A-Za-z_][\w.?!]*)/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const indent = indentOf(m[1]);
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*end\b/.test(lines[j]) && indentOf(lines[j]) === indent) {
        end = j;
        break;
      }
    }
    const kind: ChunkKind = m[2] === "def" ? "function" : "class";
    chunks.push(makeChunk(file, "Ruby", lines, m[3], kind, null, i, end, leadingComment(lines, i)));
  }
  return chunks;
}

// ---------------------------------------------------------------- C-family

const RESERVED = new Set([
  "if", "for", "while", "switch", "catch", "return", "else", "do", "try",
  "new", "typeof", "sizeof", "function", "await", "throw", "case", "with",
  "elif", "foreach", "using", "lock", "synchronized", "match", "loop",
]);

interface DeclMatch {
  name: string;
  kind: ChunkKind;
}

function matchDeclaration(line: string, language: string): DeclMatch | null {
  const t = line.trim();
  if (t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("#")) return null;

  let m: RegExpExecArray | null;

  // class / interface / struct / enum / trait / impl / object
  m = /^(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|abstract\s+|final\s+|sealed\s+|static\s+|partial\s+|data\s+|open\s+)*(class|interface|struct|enum|trait|impl|object|record)\s+([A-Za-z_$][\w$]*)/.exec(t);
  if (m) return { name: m[2], kind: "class" };

  // Go: type Foo struct {
  m = /^type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/.exec(t);
  if (m) return { name: m[1], kind: "class" };

  // function foo( / async function foo( / export default function foo(
  m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[<(]/.exec(t);
  if (m) return { name: m[1], kind: "function" };

  // Go: func (r *Recv) Name(  |  func Name(
  m = /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*[(\[]/.exec(t);
  if (m) return { name: m[1], kind: "function" };

  // Rust / Kotlin / PHP / Swift-ish: pub fn foo( | fun foo( | public function foo(
  m = /^(?:pub(?:\([^)]*\))?\s+)?(?:public\s+|private\s+|protected\s+|static\s+|async\s+|unsafe\s+|override\s+|suspend\s+|inline\s+)*(?:fn|fun|function)\s+([A-Za-z_]\w*)\s*[<(]/.exec(t);
  if (m) return { name: m[1], kind: "function" };

  // const foo = (...) => | const foo = async function | foo: (...) =>
  m = /^(?:export\s+)?(?:const|let|var|public|private|protected|readonly|static|\s)*\s*([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/.exec(t);
  if (m && !RESERVED.has(m[1])) return { name: m[1], kind: "function" };

  // Methods / C-style functions: [modifiers] [ReturnType] name(args) [throws X] {
  m = /^(?:[\w$<>\[\],.?*&:\s@]+\s+)?[*&]?([A-Za-z_$~][\w$]*)\s*\([^;]*$/.exec(t);
  if (m && !RESERVED.has(m[1]) && !/^(return|else|new|await|throw|yield|delete)\b/.test(t)) {
    // Must look like a definition, not a call such as describe("x", () => {
    const args = t.slice(t.indexOf("(") + 1);
    const looksLikeCall = /["'`]/.test(args) || /=>|\bfunction\b/.test(args) || /[=;,]\s*$/.test(t);
    if (!looksLikeCall) return { name: m[1], kind: "function" };
  }
  return null;
}

/** Index of the line holding the matching closing brace, or -1. */
function findBlockEnd(lines: string[], start: number): number {
  let depth = 0;
  let parens = 0; // braces inside (...) are default values / destructuring, not the body
  let opened = false;
  let inBlockComment = false;
  for (let i = start; i < lines.length && i < start + 2000; i++) {
    const line = lines[i];
    let inStr: string | null = null;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const nx = line[c + 1];
      if (inBlockComment) {
        if (ch === "*" && nx === "/") {
          inBlockComment = false;
          c++;
        }
        continue;
      }
      if (inStr) {
        if (ch === "\\") c++;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "/" && nx === "/") break;
      if (ch === "/" && nx === "*") {
        inBlockComment = true;
        c++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        continue;
      }
      if (ch === "(") parens++;
      else if (ch === ")") parens = Math.max(0, parens - 1);
      else if (parens > 0 && !opened) continue;
      else if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") {
        depth--;
        if (opened && depth <= 0) return i;
      } else if (ch === ";" && !opened && depth === 0) {
        return -1; // declaration without a body (prototype / abstract)
      }
    }
    // A definition's '{' must appear within a few lines of the signature.
    if (!opened && i - start > 6) return -1;
  }
  return -1;
}

function braceChunks(file: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const classRanges: { name: string; end: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const decl = matchDeclaration(lines[i], language);
    if (!decl) continue;
    const end = findBlockEnd(lines, i);
    if (end < 0) continue;

    while (classRanges.length && classRanges[classRanges.length - 1].end < i) classRanges.pop();
    const parent = classRanges.length ? classRanges[classRanges.length - 1].name : null;

    const doc = leadingComment(lines, i, language === "PHP");
    if (decl.kind === "class") {
      chunks.push(makeChunk(file, language, lines, decl.name, "class", null, i, end, doc));
      classRanges.push({ name: decl.name, end });
    } else {
      const kind: ChunkKind = parent ? "method" : "function";
      chunks.push(makeChunk(file, language, lines, decl.name, kind, parent, i, end, doc));
      // Skip the body of plain functions so nested callbacks/closures are
      // not reported as separate top-level results.
      if (!parent) i = end;
    }
  }
  return chunks;
}

// ---------------------------------------------------------------- fallback

function windowChunks(file: string, lines: string[], language: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const nonEmpty = lines.some((l) => l.trim() !== "");
  if (!nonEmpty) return chunks;
  const base = file.split("/").pop() ?? file;
  for (let start = 0; start < lines.length; start += WINDOW) {
    const end = Math.min(lines.length - 1, start + WINDOW - 1);
    if (lines.slice(start, end + 1).every((l) => l.trim() === "")) continue;
    const name = lines.length <= WINDOW ? base : `${base} [${start + 1}-${end + 1}]`;
    chunks.push(makeChunk(file, language, lines, name, "block", null, start, end, ""));
  }
  return chunks;
}

export const ALL_LANGUAGES = Array.from(new Set(Object.values(EXTENSION_LANGUAGE)));

/** File extensions to scan for the given enabled language names. */
export function extensionsForLanguages(languages: string[]): string[] {
  const wanted = new Set(languages.map((l) => l.toLowerCase()));
  return Object.entries(EXTENSION_LANGUAGE)
    .filter(([, lang]) => wanted.has(lang.toLowerCase()))
    .map(([ext]) => ext);
}
