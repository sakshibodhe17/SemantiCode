// Secondary/conceptual admin dashboard (see project scope section 7).
// Deliberately NOT the primary interface — opened only via the command
// palette ("SemantiCode: Open Admin Dashboard"), and built as a plain
// static webview (no React bundle) since it is out of scope for the
// bulk of Evaluation 2's effort.

import * as vscode from "vscode";
import {
  adminRepositories,
  adminSearchLogs,
  adminSummary,
  adminSupportedLanguages,
  adminUsers,
} from "../data/adminMockData";

export class AdminDashboardPanel {
  public static currentPanel: AdminDashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri): void {
    if (AdminDashboardPanel.currentPanel) {
      AdminDashboardPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "semanticode.adminDashboard",
      "SemantiCode — Admin Dashboard (conceptual)",
      vscode.ViewColumn.One,
      { enableScripts: false }
    );

    AdminDashboardPanel.currentPanel = new AdminDashboardPanel(panel);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = this.render();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private dispose(): void {
    AdminDashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private render(): string {
    return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
<title>SemantiCode Admin</title>
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-foreground, #ccc);
    --muted: var(--vscode-descriptionForeground, #9d9d9d);
    --border: var(--vscode-panel-border, #3c3c3c);
    --elevated: var(--vscode-editorWidget-background, #252526);
    --link: var(--vscode-textLink-foreground, #3794ff);
  }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
    padding: 24px 32px;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .subtitle { color: var(--muted); margin-top: 0; font-size: 13px; }
  .banner {
    border: 1px solid var(--border);
    background: var(--elevated);
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 12.5px;
    color: var(--muted);
    margin: 16px 0 28px;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .stat {
    border: 1px solid var(--border);
    background: var(--elevated);
    border-radius: 4px;
    padding: 14px;
    text-align: center;
  }
  .stat .value { font-size: 22px; font-weight: 600; }
  .stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 8px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10.5px; border: 1px solid var(--border); }
  .badge.indexed { color: #89d185; border-color: #89d185; }
  .badge.indexing { color: #cca700; border-color: #cca700; }
  code { font-family: var(--vscode-editor-font-family, monospace); }
  .lang-list span { display: inline-block; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; margin: 2px 4px 2px 0; font-size: 11.5px; }
</style>
</head>
<body>
  <h1>SemantiCode Admin Dashboard</h1>
  <p class="subtitle">Conceptual / secondary interface — administrators only.</p>

  <div class="banner">
    This dashboard is a low-effort, illustrative prototype for Evaluation 2.
    The primary developer experience is the VS Code sidebar extension
    (Semantic Code Search). All data below is mock data.
  </div>

  <div class="stat-grid">
    ${stat(adminSummary.totalUsers, "Users")}
    ${stat(adminSummary.totalRepositories, "Repositories")}
    ${stat(adminSummary.totalSearchesToday, "Searches Today")}
    ${stat(adminSummary.avgSearchLatencyMs + "ms", "Avg Latency")}
  </div>

  <h2>Users</h2>
  <table>
    <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Active</th></tr>
    ${adminUsers
      .map(
        (u) =>
          `<tr><td>${escapeHtml(u.name)}</td><td><code>${escapeHtml(u.email)}</code></td><td>${u.role}</td><td>${escapeHtml(u.lastActive)}</td></tr>`
      )
      .join("")}
  </table>

  <h2>Repositories</h2>
  <table>
    <tr><th>Name</th><th>Language</th><th>Files</th><th>Status</th><th>Owner</th></tr>
    ${adminRepositories
      .map(
        (r) =>
          `<tr><td><code>${escapeHtml(r.name)}</code></td><td>${r.language}</td><td>${r.files}</td><td><span class="badge ${r.status}">${r.status}</span></td><td>${escapeHtml(r.owner)}</td></tr>`
      )
      .join("")}
  </table>

  <h2>Search Logs</h2>
  <table>
    <tr><th>User</th><th>Query</th><th>Repository</th><th>Results</th><th>Time</th></tr>
    ${adminSearchLogs
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.user)}</td><td>"${escapeHtml(l.query)}"</td><td><code>${escapeHtml(l.repository)}</code></td><td>${l.resultCount}</td><td>${escapeHtml(l.timestamp)}</td></tr>`
      )
      .join("")}
  </table>

  <h2>Supported Languages</h2>
  <div class="lang-list">
    ${adminSupportedLanguages.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}
  </div>
</body>
</html>`;
  }
}

function stat(value: number | string, label: string): string {
  return `<div class="stat"><div class="value">${value}</div><div class="label">${label}</div></div>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
