// Real persistence for search history, using VS Code's globalState —
// this is genuinely working (not mocked): history survives reloading
// the Extension Development Host / restarting VS Code.

import * as vscode from "vscode";
import type { HistoryEntry as HostHistoryEntry } from "../shared/protocol";

const KEY = "semanticode.searchHistory";
const MAX_ENTRIES = 30;

export class HistoryService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getAll(): HostHistoryEntry[] {
    return this.context.globalState.get<HostHistoryEntry[]>(KEY, []);
  }

  record(entry: Omit<HostHistoryEntry, "id" | "timestamp">): HostHistoryEntry[] {
    const full: HostHistoryEntry = {
      ...entry,
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    // newest first, and the same query is not stored twice in a row
    const rest = this.getAll().filter((h) => h.query.toLowerCase() !== entry.query.toLowerCase());
    const next = [full, ...rest].slice(0, MAX_ENTRIES);
    this.context.globalState.update(KEY, next);
    return next;
  }

  clear(): void {
    this.context.globalState.update(KEY, []);
  }
}
