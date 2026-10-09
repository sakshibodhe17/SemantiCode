// Hosts the React app (built from ../webview-ui into ./webview) inside the
// VS Code sidebar and routes its messages to the real services:
// indexing, searching, opening files, settings and history.

import * as vscode from "vscode";
import { HistoryService } from "../services/historyService";
import { IndexService } from "../services/indexService";
import { runSearch } from "../services/searchService";
import { readSettings, updateSetting } from "../services/settingsService";
import type { HostToWebview, IndexProgress, SearchResult, WebviewToHost, WorkspaceInfo } from "../shared/protocol";

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "semanticode.sidebar";

  private view?: vscode.WebviewView;
  private pendingExternal: HostToWebview | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly indexService: IndexService,
    private readonly history: HistoryService
  ) {
    this.disposables.push(
      indexService.onDidChange(() => this.postWorkspace()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("semanticode")) {
          this.post({ type: "settings", settings: readSettings() });
          this.postWorkspace();
        }
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const distDir = vscode.Uri.joinPath(this.extensionUri, "webview");

    webviewView.webview.options = { enableScripts: true, localResourceRoots: [distDir] };
    webviewView.webview.html = this.renderHtml(webviewView.webview, distDir);
    webviewView.webview.onDidReceiveMessage((m: WebviewToHost) => this.handleMessage(m), null, this.disposables);
    webviewView.onDidDispose(() => (this.view = undefined), null, this.disposables);
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand("semanticode.sidebar.focus");
  }

  /** Show results produced outside the webview (e.g. "Find Similar Code"). */
  async showExternalResults(label: string, query: string, results: SearchResult[], elapsedMs: number): Promise<void> {
    const msg: HostToWebview = { type: "externalSearch", label, query, results, elapsedMs };
    if (this.view) this.post(msg);
    else this.pendingExternal = msg; // delivered once the webview says "ready"
    await this.reveal();
  }

  postProgress(progress: IndexProgress): void {
    this.post({ type: "indexProgress", progress });
  }

  postIndexError(message: string): void {
    this.post({ type: "indexError", message });
  }

  focusSearch(): void {
    this.post({ type: "focusSearch" });
  }

  private post(message: HostToWebview): void {
    void this.view?.webview.postMessage(message);
  }

  workspaceInfo(): WorkspaceInfo {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const stats = this.indexService.stats();
    const primaryLanguage =
      Object.entries(stats.languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      name: folder ? (vscode.workspace.workspaceFolders!.length > 1 ? vscode.workspace.name ?? folder.name : folder.name) : "(no folder open)",
      path: folder?.uri.fsPath ?? "",
      primaryLanguage,
      status: this.indexService.status,
      lastIndexedAt: this.indexService.builtAt,
      engine: readSettings().engine,
      stats: {
        files: stats.files,
        functions: stats.functions,
        classes: stats.classes,
        chunks: stats.chunks,
        languages: stats.languages,
        indexingTimeSeconds: this.indexService.lastDurationSeconds,
      },
    };
  }

  private postWorkspace(): void {
    this.post({ type: "workspaceInfo", workspace: this.workspaceInfo() });
  }

  private async handleMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case "ready": {
        await this.indexService.ensureLoaded();
        this.postWorkspace();
        this.post({ type: "settings", settings: readSettings() });
        this.post({ type: "historyUpdated", history: this.history.getAll() });
        if (this.pendingExternal) {
          this.post(this.pendingExternal);
          this.pendingExternal = null;
        }
        break;
      }

      case "indexWorkspace":
        await vscode.commands.executeCommand("semanticode.indexWorkspace");
        break;

      case "clearIndex":
        await this.indexService.clear();
        vscode.window.setStatusBarMessage("SemantiCode: index cleared", 2500);
        break;

      case "search": {
        const started = Date.now();
        try {
          const results = await runSearch(this.indexService, message.query, message.topK);
          const elapsedMs = Date.now() - started;
          this.post({ type: "searchResults", requestId: message.requestId, query: message.query, results, elapsedMs });
          const history = this.history.record({
            query: message.query,
            workspace: vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace",
            resultCount: results.length,
          });
          this.post({ type: "historyUpdated", history });
        } catch (err) {
          this.post({ type: "searchError", requestId: message.requestId, message: (err as Error).message });
        }
        break;
      }

      case "openFile":
        await this.openFileAtRange(message.file, message.startLine, message.endLine);
        break;

      case "clearHistory":
        this.history.clear();
        this.post({ type: "historyUpdated", history: [] });
        break;

      case "updateSetting":
        await updateSetting(message.key, message.value);
        break;

      case "openSettingsJson":
        await vscode.commands.executeCommand("workbench.action.openSettings", "semanticode");
        break;
    }
  }

  async openFileAtRange(relativePath: string, startLine: number, endLine: number): Promise<boolean> {
    const uri = this.indexService.resolve(relativePath);
    if (!uri) {
      vscode.window.showWarningMessage("SemantiCode: no workspace folder is open.");
      this.post({ type: "openFileAck", file: relativePath, ok: false });
      return false;
    }
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const last = Math.max(doc.lineCount - 1, 0);
      const start = new vscode.Position(Math.min(Math.max(startLine - 1, 0), last), 0);
      const endLineIdx = Math.min(Math.max(endLine - 1, 0), last);
      const end = new vscode.Position(endLineIdx, doc.lineAt(endLineIdx).text.length);
      editor.selection = new vscode.Selection(start, start);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      flashRange(editor, new vscode.Range(start, end));
      this.post({ type: "openFileAck", file: relativePath, ok: true });
      return true;
    } catch (err) {
      vscode.window.showWarningMessage(`SemantiCode: could not open ${relativePath} — ${(err as Error).message}`);
      this.post({ type: "openFileAck", file: relativePath, ok: false });
      return false;
    }
  }

  private renderHtml(webview: vscode.Webview, distDir: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "main.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distDir, "main.css"));
    const nonce = getNonce();
    return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>SemantiCode</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

/** Briefly highlight the matched code range in the editor. */
const flashDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
  isWholeLine: true,
});

export function flashRange(editor: vscode.TextEditor, range: vscode.Range): void {
  editor.setDecorations(flashDecoration, [range]);
  setTimeout(() => editor.setDecorations(flashDecoration, []), 1600);
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

