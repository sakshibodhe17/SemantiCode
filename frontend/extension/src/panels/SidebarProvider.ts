// Hosts the React app (built by webview-ui/) inside VS Code's sidebar
// as a WebviewView. This is the seam between "real VS Code extension"
// and "mock search prototype": everything in this file talks to real
// vscode.* APIs, and only forwards a few clearly-labeled mock-adjacent
// events (searchExecuted result counts) without inventing any AI
// behavior itself.

import * as vscode from "vscode";
import { HistoryService } from "../services/historyService";
import { readSettings, updateSetting } from "../services/settingsService";
import { detectWorkspace, mockIndexStats } from "../services/workspaceService";
import type { InboundToWebview, OutboundFromWebview } from "../messaging";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "semanticode.sidebar";

  private view?: vscode.WebviewView;
  private readonly history: HistoryService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.history = new HistoryService(context);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    const webviewDist = vscode.Uri.joinPath(this.extensionUri, "..", "webview-ui", "dist");

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewDist],
    };

    webviewView.webview.html = this.renderHtml(webviewView.webview, webviewDist);

    webviewView.webview.onDidReceiveMessage((message: OutboundFromWebview) =>
      this.handleMessage(message)
    );
  }

  /** Reveals + focuses the sidebar view (used by the command palette entry). */
  async reveal(): Promise<void> {
    await vscode.commands.executeCommand("semanticode.sidebar.focus");
  }

  private post(message: InboundToWebview): void {
    this.view?.webview.postMessage(message);
  }

  private async handleMessage(message: OutboundFromWebview): Promise<void> {
    switch (message.type) {
      case "ready": {
        const workspace = (await detectWorkspace()) ?? {
          name: "(no folder open)",
          path: "",
          primaryLanguage: "Python",
          status: "not-indexed" as const,
          lastIndexedAt: null,
          stats: { files: 0, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0 },
        };
        this.post({ type: "workspaceInfo", workspace });
        this.post({ type: "settingsInitial", settings: readSettings() });
        this.post({ type: "historyUpdated", history: this.history.getAll() });
        break;
      }

      case "openFile": {
        await this.openFileAtRange(message.file, message.startLine, message.endLine);
        break;
      }

      case "searchExecuted": {
        // Persisted silently (not echoed back) so the webview's own
        // optimistic history update stays the single source of truth
        // for the live session; this just seeds the *next* session.
        this.history.record({
          query: message.query,
          workspace: vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace",
          resultCount: message.resultCount,
        });
        break;
      }

      case "clearHistory": {
        this.history.clear();
        break;
      }

      case "updateSetting": {
        await updateSetting(message.key, message.value);
        break;
      }

      case "reindexWorkspace":
      case "clearIndex": {
        // TODO: trigger a real indexing job once the FastAPI backend
        // (Tree-sitter -> CodeBERT -> FAISS) exists. For this
        // milestone the progress animation and stats are fully owned
        // by the webview (see webview-ui/src/App.tsx runIndexing()).
        void mockIndexStats; // referenced so the intent stays documented
        break;
      }
    }
  }

  private async openFileAtRange(
    relativePath: string,
    startLine: number,
    endLine: number
  ): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showWarningMessage("SemantiCode: no workspace folder is open.");
      this.post({ type: "openFileAck", file: relativePath, ok: false });
      return;
    }

    const fileUri = vscode.Uri.joinPath(folder.uri, relativePath);

    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });

      const start = new vscode.Position(Math.max(startLine - 1, 0), 0);
      const end = new vscode.Position(Math.max(endLine - 1, 0), 0);
      const range = new vscode.Range(start, end);

      editor.selection = new vscode.Selection(start, start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      this.post({ type: "openFileAck", file: relativePath, ok: true });
    } catch (err) {
      vscode.window.showWarningMessage(
        `SemantiCode: could not open ${relativePath} — ${(err as Error).message}`
      );
      this.post({ type: "openFileAck", file: relativePath, ok: false });
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
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
  />
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
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
