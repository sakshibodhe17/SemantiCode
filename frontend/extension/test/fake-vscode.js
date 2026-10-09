// Minimal stand-in for the `vscode` module so the real extension bundle can be
// activated and exercised in plain Node (integration smoke test). Only the
// APIs SemantiCode touches are implemented.
const fs = require("node:fs");
const path = require("node:path");
const pkg = require("../package.json");

class Uri {
  constructor(p) { this.fsPath = path.resolve(p); this.path = this.fsPath.split(path.sep).join("/"); this.scheme = "file"; }
  static file(p) { return new Uri(p); }
  static joinPath(base, ...parts) { return new Uri(path.join(base.fsPath, ...parts)); }
  toString() { return "file://" + this.path; }
}
class EventEmitter {
  constructor() { this.l = new Set(); this.event = (fn) => { this.l.add(fn); return { dispose: () => this.l.delete(fn) }; }; }
  fire(e) { for (const fn of this.l) fn(e); }
  dispose() { this.l.clear(); }
}
class CancellationError extends Error {}
const disposable = { dispose() {} };
const commands = new Map();
const configChange = new EventEmitter();
const settings = {};
const log = { info: [], errors: [], opened: [] };

const state = { root: null, storage: null, provider: null };

function globToRegex(glob) {
  // supports **/*.{a,b} and {**/x/**,...}
  let g = glob.replace(/^\{(.*)\}$/, "$1");
  const alts = splitTop(g);
  return alts.map((a) => new RegExp("^" + a.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\{([^}]*)\}/g, (_, x) => "(" + x.split(",").join("|") + ")").replace(/\*\*\//g, "(?:.*/)?").replace(/\/\*\*/g, "(?:/.*)?").replace(/\*/g, "[^/]*") + "$"));
}
function splitTop(s) { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "{") d++; if (c === "}") d--; if (c === "," && d === 0) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; }
function walk(dir, acc = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, acc); else acc.push(p); } return acc; }

const workspace = {
  get workspaceFolders() { return state.root ? [{ uri: Uri.file(state.root), name: path.basename(state.root), index: 0 }] : undefined; },
  name: undefined,
  async findFiles(include, exclude, max) {
    const inc = globToRegex(include), exc = exclude ? globToRegex(exclude) : [];
    const files = walk(state.root).map((f) => path.relative(state.root, f).split(path.sep).join("/"))
      .filter((r) => inc.some((re) => re.test(r)) && !exc.some((re) => re.test(r)));
    return files.slice(0, max).map((r) => Uri.file(path.join(state.root, r)));
  },
  asRelativePath(uri) { return path.relative(state.root, uri.fsPath).split(path.sep).join("/"); },
  getConfiguration(section) {
    return {
      get(key, def) { const full = `${section}.${key}`; if (full in settings) return settings[full]; const p = pkg.contributes.configuration.properties[full]; return p ? p.default : def; },
      async update(key, value) { settings[`${section}.${key}`] = value; configChange.fire({ affectsConfiguration: (s) => `${section}.${key}`.startsWith(s) }); },
    };
  },
  onDidChangeConfiguration: configChange.event,
  onDidChangeWorkspaceFolders: () => disposable,
  createFileSystemWatcher() { return { onDidChange() {}, onDidCreate() {}, onDidDelete() {}, dispose() {} }; },
  fs: {
    async stat(u) { const s = fs.statSync(u.fsPath); return { mtime: s.mtimeMs, size: s.size }; },
    async readFile(u) { return new Uint8Array(fs.readFileSync(u.fsPath)); },
    async writeFile(u, d) { fs.writeFileSync(u.fsPath, d); },
    async createDirectory(u) { fs.mkdirSync(u.fsPath, { recursive: true }); },
    async delete(u) { fs.rmSync(u.fsPath); },
  },
  async openTextDocument(u) { const lines = fs.readFileSync(u.fsPath, "utf8").split("\n"); return { uri: u, lineCount: lines.length, lineAt: (i) => ({ text: lines[i] }) }; },
};

const window = {
  createStatusBarItem() { return { show() {}, dispose() {}, text: "", tooltip: "" }; },
  registerWebviewViewProvider(id, provider) { state.provider = provider; return disposable; },
  async withProgress(opts, task) { return task({ report() {} }, { isCancellationRequested: false, onCancellationRequested: () => disposable }); },
  setStatusBarMessage(m) { log.info.push(m); return disposable; },
  async showInformationMessage(m, ...items) { log.info.push(m); return items[0]; },
  async showErrorMessage(m) { log.errors.push(m); },
  async showWarningMessage(m) { log.errors.push(m); },
  createTextEditorDecorationType() { return disposable; },
  async showTextDocument(doc) { log.opened.push(doc.uri.fsPath); return { selection: null, revealRange() {}, setDecorations() {} }; },
  createQuickPick() { throw new Error("not needed"); },
  createWebviewPanel() { return { webview: { html: "" }, reveal() {}, onDidDispose() {} }; },
};

module.exports = {
  Uri, EventEmitter, CancellationError, workspace, window,
  commands: {
    registerCommand(id, fn) { commands.set(id, fn); return disposable; },
    async executeCommand(id, ...a) { const f = commands.get(id); return f ? f(...a) : undefined; },
  },
  Position: class { constructor(l, c) { this.line = l; this.character = c; } },
  Range: class { constructor(a, b) { this.start = a; this.end = b; } },
  Selection: class { constructor(a, b) { this.anchor = a; this.active = b; } },
  ThemeColor: class { constructor(id) { this.id = id; } },
  ProgressLocation: { Notification: 15 }, StatusBarAlignment: { Left: 1 }, ConfigurationTarget: { Global: 1 },
  TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
  __state: state, __log: log, __settings: settings,
};
