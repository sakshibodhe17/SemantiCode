// SemantiCode extension entry point.
//
// Registers the sidebar view, the commands (Index, Search, Quick Search,
// Find Similar Code, Clear Index, Index Insights) and a status-bar item.
// All real work happens in services/indexService.ts (indexing) and
// engine/* (chunking + ranking).

import * as vscode from "vscode";
import { InsightsPanel } from "./panels/InsightsPanel";
import { SidebarProvider } from "./panels/SidebarProvider";
import { HistoryService } from "./services/historyService";
import { IndexService } from "./services/indexService";
import { backendIndex, runSearch } from "./services/searchService";
import { readSettings } from "./services/settingsService";
import type { SearchResult } from "./shared/protocol";

export function activate(context: vscode.ExtensionContext): void {
  const indexService = new IndexService(context);
  const history = new HistoryService(context);
  const sidebar = new SidebarProvider(context.extensionUri, indexService, history);
  context.subscriptions.push(indexService, sidebar);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ---------------------------------------------------------------- status bar
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "semanticode.quickSearch";
  const refreshStatus = () => {
    const s = indexService.stats();
    if (indexService.status === "indexing") {
      status.text = "$(sync~spin) SemantiCode: indexing…";
      status.tooltip = "Indexing workspace";
    } else if (indexService.status === "indexed") {
      status.text = `$(search) SemantiCode: ${s.chunks.toLocaleString()} units`;
      status.tooltip = `${s.files} files indexed — click to search by meaning`;
    } else {
      status.text = "$(search) SemantiCode: not indexed";
      status.tooltip = "Click to search (you will be asked to index first)";
    }
    status.show();
  };
  refreshStatus();
  context.subscriptions.push(status, indexService.onDidChange(refreshStatus));
  void indexService.ensureLoaded();

  // ---------------------------------------------------------------- indexing
  const indexWorkspace = async (): Promise<boolean> => {
    try {
      const stats = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "SemantiCode", cancellable: true },
        async (progress, token) => {
          let last = 0;
          const result = await indexService.buildIndex((p) => {
            sidebar.postProgress(p);
            if (p.phase === "parse" && p.total) {
              const pct = Math.floor((p.current / p.total) * 90);
              progress.report({ message: `Parsing ${p.current}/${p.total} files`, increment: pct - last });
              last = pct;
            } else {
              progress.report({ message: p.message });
            }
          }, token);
          if (readSettings().engine === "backend") {
            progress.report({ message: "Sending workspace to the FastAPI backend…" });
            await backendIndex();
          }
          return result;
        }
      );
      vscode.window.setStatusBarMessage(
        `$(check) SemantiCode: indexed ${stats.files} files → ${stats.chunks} code units`,
        5000
      );
      return true;
    } catch (err) {
      if (err instanceof vscode.CancellationError) {
        vscode.window.setStatusBarMessage("SemantiCode: indexing cancelled", 3000);
        return false;
      }
      sidebar.postIndexError((err as Error).message);
      vscode.window.showErrorMessage(`SemantiCode: ${(err as Error).message}`);
      return false;
    }
  };

  /** Ask to index when a search is attempted on an un-indexed workspace. */
  const ensureIndexed = async (): Promise<boolean> => {
    await indexService.ensureLoaded();
    if (indexService.isReady() || readSettings().engine === "backend") return true;
    const choice = await vscode.window.showInformationMessage(
      "SemantiCode needs to index this workspace before searching (takes a few seconds).",
      "Index Now"
    );
    return choice === "Index Now" ? indexWorkspace() : false;
  };

  // ---------------------------------------------------------------- quick search
  const quickSearch = async (initial = "") => {
    if (!(await ensureIndexed())) return;
    const qp = vscode.window.createQuickPick<vscode.QuickPickItem & { result?: SearchResult }>();
    qp.placeholder = "Describe what the code does, e.g. “where is the JWT token created”  (filters: lang:py in:src/ kind:class)";
    qp.matchOnDescription = false;
    qp.matchOnDetail = false;
    qp.value = initial;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    const update = (value: string) => {
      if (timer) clearTimeout(timer);
      if (value.trim().length < 3) {
        qp.items = [];
        return;
      }
      timer = setTimeout(async () => {
        const mine = ++seq;
        qp.busy = true;
        try {
          const results = await runSearch(indexService, value.trim(), readSettings().topK);
          if (mine !== seq) return;
          qp.items = results.map((r) => ({
            label: `$(symbol-${r.kind === "class" ? "class" : r.kind === "block" ? "file" : "method"}) ${r.className ? r.className + "." : ""}${r.name}`,
            description: `${r.similarity.toFixed(1)}%`,
            detail: `${r.file}:${r.startLine}–${r.endLine}   ·   matched: ${r.matched.map((m) => m.term).join(", ")}`,
            alwaysShow: true,
            result: r,
          }));
        } catch (err) {
          qp.items = [{ label: `$(error) ${(err as Error).message}`, alwaysShow: true }];
        } finally {
          if (mine === seq) qp.busy = false;
        }
      }, 180);
    };
    qp.onDidChangeValue(update);
    qp.onDidAccept(async () => {
      const picked = qp.selectedItems[0]?.result;
      if (!picked) return;
      qp.hide();
      history.record({
        query: qp.value.trim(),
        workspace: vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace",
        resultCount: qp.items.length,
      });
      await sidebar.openFileAtRange(picked.file, picked.startLine, picked.endLine);
    });
    qp.onDidHide(() => qp.dispose());
    qp.show();
    if (initial) update(initial);
  };

  // ---------------------------------------------------------------- find similar
  const findSimilar = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const sel = editor.selection;
    const text = sel.isEmpty
      ? editor.document.getText(editor.document.getWordRangeAtPosition(sel.active) ?? sel)
      : editor.document.getText(sel);
    if (!text.trim()) {
      vscode.window.showInformationMessage("SemantiCode: select some code first.");
      return;
    }
    if (!(await ensureIndexed())) return;
    const started = Date.now();
    try {
      const own = indexService.relativePath(editor.document.uri);
      const results = (await runSearch(indexService, text, readSettings().topK + 1, { expand: false }))
        // drop the selection's own location
        .filter((r) => !(r.file === own && r.startLine <= sel.start.line + 1 && r.endLine >= sel.end.line + 1))
        .slice(0, readSettings().topK);
      const label = text.length > 60 ? `${text.slice(0, 57).replace(/\s+/g, " ")}…` : text.replace(/\s+/g, " ");
      await sidebar.showExternalResults(`Similar to: ${label}`, label, results, Date.now() - started);
    } catch (err) {
      vscode.window.showErrorMessage(`SemantiCode: ${(err as Error).message}`);
    }
  };

  // ---------------------------------------------------------------- commands
  context.subscriptions.push(
    vscode.commands.registerCommand("semanticode.focus", () => sidebar.reveal()),
    vscode.commands.registerCommand("semanticode.indexWorkspace", indexWorkspace),
    vscode.commands.registerCommand("semanticode.searchCode", async () => {
      await sidebar.reveal();
      sidebar.focusSearch();
    }),
    vscode.commands.registerCommand("semanticode.quickSearch", () => quickSearch()),
    vscode.commands.registerCommand("semanticode.findSimilar", findSimilar),
    vscode.commands.registerCommand("semanticode.clearIndex", async () => {
      await indexService.clear();
      vscode.window.setStatusBarMessage("SemantiCode: index cleared", 2500);
    }),
    vscode.commands.registerCommand("semanticode.showInsights", () => InsightsPanel.show(indexService, history))
  );
}

export function deactivate(): void {
  // All disposables are registered on context.subscriptions.
}
