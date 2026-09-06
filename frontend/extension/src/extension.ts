import * as vscode from "vscode";
import { SidebarProvider } from "./panels/SidebarProvider";
import { AdminDashboardPanel } from "./panels/AdminDashboardPanel";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new SidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("semanticode.focus", () => sidebarProvider.reveal())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("semanticode.indexWorkspace", () => sidebarProvider.reveal())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("semanticode.searchCode", () => sidebarProvider.reveal())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("semanticode.openAdminDashboard", () =>
      AdminDashboardPanel.createOrShow(context.extensionUri)
    )
  );
}

export function deactivate(): void {
  // Nothing to clean up explicitly — all disposables are registered on
  // context.subscriptions and are torn down by VS Code automatically.
}
