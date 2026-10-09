// "Index Insights" — a read-only dashboard in an editor tab, built from the
// real index and real search history (replaces the earlier mock admin
// dashboard). Useful in a demo to show *what* was indexed and *how* people
// search, and in practice to spot files that were skipped or huge.

import * as vscode from "vscode";
import type { HistoryService } from "../services/historyService";
import type { IndexService } from "../services/indexService";
import { readSettings } from "../services/settingsService";

export class InsightsPanel {
  private static current: InsightsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static show(indexService: IndexService, history: HistoryService): void {
    if (InsightsPanel.current) {
      InsightsPanel.current.panel.reveal();
      InsightsPanel.current.render();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "semanticode.insights",
      "SemantiCode — Index Insights",
      vscode.ViewColumn.Active,
      { enableScripts: false }
    );
    InsightsPanel.current = new InsightsPanel(panel, indexService, history);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly indexService: IndexService,
    private readonly history: HistoryService
  ) {
    this.panel = panel;
    this.render();
    this.disposables.push(indexService.onDidChange(() => this.render()));
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private dispose(): void {
    InsightsPanel.current = undefined;
    this.disposables.forEach((d) => d.dispose());
  }

  private render(): void {
    const stats = this.indexService.stats();
    const settings = readSettings();
    const searches = this.history.getAll();
    const langs = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
    const maxLang = Math.max(1, ...langs.map(([, n]) => n));
    const avgResults = searches.length
      ? (searches.reduce((s, h) => s + h.resultCount, 0) / searches.length).toFixed(1)
      : "—";

    this.panel.webview.html = /* html */ `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
<style>
  body { background: var(--vscode-editor-background); color: var(--vscode-foreground); font-family: var(--vscode-font-family); padding: 24px 32px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; } .muted { color: var(--vscode-descriptionForeground); font-size: 12.5px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0 8px; }
  .stat { border: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); border-radius: 6px; padding: 14px; }
  .stat .v { font-size: 22px; font-weight: 600; font-family: var(--vscode-editor-font-family); } .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--vscode-descriptionForeground); }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--vscode-descriptionForeground); border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 6px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); } th { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
  .bar { height: 8px; background: var(--vscode-progressBar-background); border-radius: 4px; }
  code { font-family: var(--vscode-editor-font-family); }
</style></head><body>
  <h1>Index Insights</h1>
  <div class="muted">Workspace <code>${esc(vscode.workspace.workspaceFolders?.map((f) => f.name).join(", ") ?? "—")}</code> · status <b>${esc(this.indexService.status)}</b> · engine <b>${esc(settings.rankingModel)}</b>${this.indexService.builtAt ? ` · last indexed ${esc(new Date(this.indexService.builtAt).toLocaleString())}` : ""}</div>
  <div class="grid">
    ${stat(stats.files, "Files")}${stat(stats.functions, "Functions & methods")}${stat(stats.classes, "Classes")}${stat(stats.chunks, "Searchable units")}${stat(this.indexService.lastDurationSeconds + "s", "Last index time")}${stat(searches.length, "Saved searches")}
  </div>
  <h2>Languages</h2>
  ${langs.length ? `<table>${langs.map(([l, n]) => `<tr><td style="width:140px">${esc(l)}</td><td><div class="bar" style="width:${Math.round((n / maxLang) * 100)}%"></div></td><td style="width:70px">${n} files</td></tr>`).join("")}</table>` : `<p class="muted">Nothing indexed yet — run “SemantiCode: Index Workspace”.</p>`}
  <h2>Recent searches (avg ${avgResults} results)</h2>
  ${searches.length ? `<table><tr><th>Query</th><th>Workspace</th><th>Results</th><th>When</th></tr>${searches.slice(0, 15).map((h) => `<tr><td>${esc(h.query)}</td><td><code>${esc(h.workspace)}</code></td><td>${h.resultCount}</td><td>${esc(new Date(h.timestamp).toLocaleString())}</td></tr>`).join("")}</table>` : `<p class="muted">No searches yet.</p>`}
</body></html>`;
  }
}

function stat(value: number | string, label: string): string {
  return `<div class="stat"><div class="v">${typeof value === "number" ? value.toLocaleString() : esc(value)}</div><div class="l">${esc(label)}</div></div>`;
}

function esc(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
