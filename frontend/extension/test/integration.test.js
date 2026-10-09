// Integration smoke test: loads the REAL bundled extension (dist/extension.js)
// against a fake `vscode` module, opens the sidebar, and drives it with the
// same messages the React UI sends. Run: node test/integration.test.js <folder>
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const fake = require("./fake-vscode");
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === "vscode" ? fake : origLoad.call(this, req, ...rest); };

const ext = require("../dist/extension.js");
const root = path.resolve(process.argv[2] ?? "../../backend");
fake.__state.root = root;
const storage = fs.mkdtempSync(path.join(os.tmpdir(), "semanticode-"));
const globalState = new Map();
const context = {
  subscriptions: [],
  extensionUri: fake.Uri.file(path.join(__dirname, "..")),
  storageUri: fake.Uri.file(storage),
  globalState: { get: (k, d) => globalState.get(k) ?? d, update: async (k, v) => globalState.set(k, v) },
};

const posted = [];
let handler;
const webviewView = {
  webview: {
    options: {}, html: "", cspSource: "vscode-resource:",
    asWebviewUri: (u) => u,
    onDidReceiveMessage: (fn) => { handler = fn; return { dispose() {} }; },
    postMessage: async (m) => { posted.push(m); return true; },
  },
  onDidDispose: () => ({ dispose() {} }),
};
const wait = (pred, ms = 5000) => new Promise((res, rej) => { const t0 = Date.now(); const i = setInterval(() => { const v = pred(); if (v) { clearInterval(i); res(v); } else if (Date.now() - t0 > ms) { clearInterval(i); rej(new Error("timeout")); } }, 20); });
const last = (type) => [...posted].reverse().find((m) => m.type === type);
let failures = 0;
const check = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) failures++; };

(async () => {
  ext.activate(context);
  fake.__state.provider.resolveWebviewView(webviewView);
  check(webviewView.webview.html.includes("main.js") && fs.existsSync(path.join(__dirname, "../webview/main.js")), "webview HTML references bundled main.js that exists");

  await handler({ type: "ready" });
  check(last("workspaceInfo")?.workspace.status === "not-indexed", "initial status not-indexed");
  check(last("settings")?.settings.topK === 10, "settings delivered");

  await handler({ type: "search", query: "jwt token", topK: 5, requestId: 1 });
  check(/not been indexed/.test(last("searchError")?.message ?? ""), "search before indexing returns a helpful error");

  await handler({ type: "indexWorkspace" });
  const info = await wait(() => { const w = last("workspaceInfo"); return w?.workspace.status === "indexed" && w; });
  const s = info.workspace.stats;
  console.log("     stats:", JSON.stringify(s));
  check(s.files > 0 && s.chunks >= s.files && s.functions > 0, "real stats after indexing");
  check(posted.some((m) => m.type === "indexProgress" && m.progress.phase === "parse"), "progress events streamed");
  check(posted.some((m) => m.type === "indexProgress" && m.progress.phase === "done"), "done event streamed");
  check(fs.existsSync(path.join(storage, "index.json")), "index persisted to workspace storage");

  await handler({ type: "search", query: "Where is the JWT token created?", topK: 5, requestId: 2 });
  const r = last("searchResults");
  check(r?.requestId === 2 && r.results.length > 0, "search returns results");
  console.log("     top:", r.results.slice(0, 3).map((x) => `${x.name} ${x.similarity}% ${x.file}:${x.startLine}`).join(" | "));
  check(last("historyUpdated")?.history[0]?.query === "Where is the JWT token created?", "history recorded");

  await handler({ type: "openFile", file: r.results[0].file, startLine: r.results[0].startLine, endLine: r.results[0].endLine });
  check(last("openFileAck")?.ok === true && fake.__log.opened.length === 1, "open in editor works");

  await handler({ type: "updateSetting", key: "topK", value: 3 });
  check(fake.__settings["semanticode.topK"] === 3, "setting written to VS Code config");

  await handler({ type: "search", query: "lang:python kind:class user", topK: 10, requestId: 3 });
  check(last("searchResults")?.results.every((x) => x.kind === "class"), "query filters work");

  // Second activation: index should load from disk (no re-index needed)
  posted.length = 0;
  const ext2ctx = { ...context, subscriptions: [] };
  ext.activate(ext2ctx);
  fake.__state.provider.resolveWebviewView(webviewView);
  await handler({ type: "ready" });
  check(last("workspaceInfo")?.workspace.status === "indexed", "index reloaded from disk on next start");

  await handler({ type: "clearIndex" });
  check(last("workspaceInfo")?.workspace.status === "not-indexed" && !fs.existsSync(path.join(storage, "index.json")), "clear index removes it");

  console.log(failures ? `\n${failures} FAILED` : "\nALL INTEGRATION CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
