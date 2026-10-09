// Browser preview host.
//
// When the React UI is opened in a normal browser (npm run dev, or the
// Playwright UI check) there is no VS Code extension host to answer its
// messages. This tiny stand-in answers them with sample data so the UI can
// be reviewed and tested standalone. It is never used inside VS Code.

import type { InboundMessage, OutboundMessage } from "./messaging";
import { generatedSearchEntries } from "./data/searchEntries.generated";
import { defaultSettings } from "./data/defaults";
import type { HistoryEntry, IndexProgress, SearchResult, Settings, WorkspaceInfo } from "./data/types";

let settings: Settings = { ...defaultSettings };
let history: HistoryEntry[] = [];
const workspace: WorkspaceInfo = {
  name: "sample-project (browser preview)",
  path: "/preview/sample-project",
  primaryLanguage: "Python",
  status: "not-indexed",
  lastIndexedAt: null,
  engine: "local",
  stats: { files: 0, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0, languages: {} },
};

function send(msg: InboundMessage, delay = 0) {
  setTimeout(() => window.postMessage(msg, "*"), delay);
}

function words(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 2);
}

function search(query: string, topK: number): SearchResult[] {
  const q = words(query);
  return generatedSearchEntries
    .map((e) => {
      const hay = new Set([...e.tags, ...words(e.name), ...words(e.file)]);
      const matched = q.filter((t) => hay.has(t) || [...hay].some((h) => h.startsWith(t.slice(0, 4))));
      return { e, matched, score: matched.length / Math.max(q.length, 1) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ e, matched, score }) => ({
      id: e.id,
      similarity: Math.round(Math.min(99, 40 + 59 * score) * 100) / 100,
      name: e.name,
      className: e.className,
      kind: e.className ? "method" : "function",
      language: "Python",
      file: e.file,
      startLine: e.startLine,
      endLine: e.endLine,
      code: e.code,
      matched: matched.map((term) => ({ term, via: "exact" as const })),
    }));
}

export function handleDevMessage(message: unknown): void {
  const msg = message as OutboundMessage;
  switch (msg.type) {
    case "ready":
      send({ type: "workspaceInfo", workspace });
      send({ type: "settings", settings });
      send({ type: "historyUpdated", history });
      break;
    case "indexWorkspace": {
      workspace.status = "indexing";
      send({ type: "workspaceInfo", workspace: { ...workspace } });
      const phases: IndexProgress["phase"][] = ["detect", "scan", "parse", "build", "save", "done"];
      phases.forEach((phase, i) =>
        send({ type: "indexProgress", progress: { phase, current: 6, total: 6, message: `${phase}…` } }, 150 * (i + 1))
      );
      setTimeout(() => {
        workspace.status = "indexed";
        workspace.lastIndexedAt = new Date().toISOString();
        workspace.stats = { files: 6, functions: 9, classes: 2, chunks: 14, indexingTimeSeconds: 0.1, languages: { Python: 6 } };
        send({ type: "workspaceInfo", workspace: { ...workspace } });
      }, 150 * (phases.length + 1));
      break;
    }
    case "clearIndex":
      workspace.status = "not-indexed";
      workspace.stats = { files: 0, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0, languages: {} };
      send({ type: "workspaceInfo", workspace: { ...workspace } });
      break;
    case "search": {
      const results = search(msg.query, msg.topK);
      history = [{ id: String(Date.now()), query: msg.query, workspace: "sample-project", timestamp: new Date().toISOString(), resultCount: results.length }, ...history];
      send({ type: "searchResults", requestId: msg.requestId, query: msg.query, results, elapsedMs: 3 }, 120);
      send({ type: "historyUpdated", history }, 130);
      break;
    }
    case "clearHistory":
      history = [];
      send({ type: "historyUpdated", history });
      break;
    case "updateSetting":
      settings = { ...settings, [msg.key]: msg.value } as Settings;
      send({ type: "settings", settings });
      break;
    default:
      break;
  }
}
