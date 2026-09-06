import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import {
  defaultSettings,
  indexingStepsTemplate,
  mockPreIndexStats,
  mockSearchHistory,
  mockWorkspace,
  suggestedQueries,
} from "./data/mockData";
import type {
  HistoryEntry,
  IndexingStepState,
  ScreenId,
  SearchResult,
  SemantiCodeSettings,
  WorkspaceInfo,
} from "./data/types";
import type { InboundMessage } from "./messaging";
import { getVsCodeApi } from "./vscodeApi";
import { mockSearch } from "./services/searchService";
import { HistoryScreen } from "./screens/HistoryScreen";
import { IndexingScreen } from "./screens/IndexingScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

const vscode = getVsCodeApi();

const STEP_DELAY_MS = 420;

function freshSteps(): IndexingStepState[] {
  return indexingStepsTemplate.map((s) => ({ ...s, status: "pending" as const }));
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("welcome");
  const [workspace, setWorkspace] = useState<WorkspaceInfo>({
    ...mockWorkspace,
    status: "not-indexed",
  });

  const [indexingSteps, setIndexingSteps] = useState<IndexingStepState[]>(freshSteps());
  const [isIndexing, setIsIndexing] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(defaultSettings.topK);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(mockSearchHistory);
  const [settings, setSettings] = useState<SemantiCodeSettings>(defaultSettings);
  const [toast, setToast] = useState<string | null>(null);

  // Tell the extension host we're mounted so it can send back the real
  // workspace name/path, persisted settings, and search history. In
  // standalone browser mode nothing replies, so the mock defaults above
  // just stay as-is.
  useEffect(() => {
    vscode.postMessage({ type: "ready" });

    function onMessage(event: MessageEvent<InboundMessage>) {
      const msg = event.data;
      switch (msg.type) {
        case "workspaceInfo":
          // Real workspace identity (name/path/language) comes from the
          // extension host. Stats/status stay whatever this webview's
          // own (mock) indexing flow has already produced, so the real
          // folder name never gets clobbered by placeholder numbers.
          setWorkspace((prev) => ({
            ...prev,
            name: msg.workspace.name,
            path: msg.workspace.path,
            primaryLanguage: msg.workspace.primaryLanguage,
          }));
          break;
        case "historyUpdated":
          setHistory(msg.history);
          break;
        case "settingsInitial":
          setSettings(msg.settings);
          setTopK(msg.settings.topK);
          break;
        case "openFileAck":
          if (!msg.ok) showToast(`Could not open ${msg.file}`);
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    const id = setTimeout(() => setToast(null), 2600);
    timeouts.current.push(id);
  }, []);

  const runIndexing = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    setScreen("indexing");
    setIsIndexing(true);
    setWorkspace((w) => ({ ...w, status: "indexing" }));
    const steps = freshSteps();
    setIndexingSteps(steps);

    steps.forEach((_, i) => {
      const t1 = setTimeout(() => {
        setIndexingSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "active" } : idx < i ? { ...s, status: "done" } : s
          )
        );
      }, i * STEP_DELAY_MS);
      timeouts.current.push(t1);
    });

    const finishAt = steps.length * STEP_DELAY_MS;
    const t2 = setTimeout(() => {
      setIndexingSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      setIsIndexing(false);
      setWorkspace((w) => ({
        ...w,
        status: "indexed",
        stats: mockWorkspace.stats,
        lastIndexedAt: new Date().toISOString(),
      }));
    }, finishAt);
    timeouts.current.push(t2);
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 4) return;
      setIsSearching(true);
      setSelectedResult(null);
      const t = setTimeout(() => {
        const r = mockSearch(trimmed, topK);
        setResults(r);
        setIsSearching(false);
        vscode.postMessage({ type: "searchExecuted", query: trimmed, resultCount: r.length });
        setHistory((prev) => [
          {
            id: `h-${Date.now()}`,
            query: trimmed,
            workspace: workspace.name,
            timestamp: new Date().toISOString(),
            resultCount: r.length,
          },
          ...prev,
        ]);
      }, 550);
      timeouts.current.push(t);
    },
    [topK, workspace.name]
  );

  const handleOpenInEditor = useCallback((result: SearchResult) => {
    vscode.postMessage({
      type: "openFile",
      file: result.file,
      startLine: result.startLine,
      endLine: result.endLine,
    });
    showToast(`Opening ${result.file}:${result.startLine} …`);
  }, [showToast]);

  return (
    <div className="sc-app">
      <Header workspace={workspace} />
      <div className="sc-body">
        <Sidebar active={screen} onSelect={setScreen} />
        <main className="sc-content">
          {screen === "welcome" && (
            <WelcomeScreen
              workspace={workspace}
              preIndexFileCount={mockPreIndexStats.files}
              onIndexWorkspace={runIndexing}
              onSearchCode={() => setScreen("search")}
            />
          )}

          {screen === "search" && (
            <SearchScreen
              workspace={workspace}
              query={query}
              onQueryChange={setQuery}
              onSubmit={() => runSearch(query)}
              topK={topK}
              onTopKChange={setTopK}
              isSearching={isSearching}
              results={results}
              selectedResult={selectedResult}
              onView={setSelectedResult}
              onClosePreview={() => setSelectedResult(null)}
              onOpenInEditor={handleOpenInEditor}
              suggestedQueries={suggestedQueries}
              onPickSuggested={(q) => {
                setQuery(q);
                runSearch(q);
              }}
            />
          )}

          {screen === "workspace" && (
            <WorkspaceScreen
              workspace={workspace}
              onReindex={runIndexing}
              onClearIndex={() => {
                timeouts.current.forEach(clearTimeout);
                setIsIndexing(false);
                setIndexingSteps(freshSteps());
                setResults(null);
                setSelectedResult(null);
                setWorkspace((w) => ({
                  ...w,
                  status: "not-indexed",
                  lastIndexedAt: null,
                  stats: { files: mockPreIndexStats.files, functions: 0, classes: 0, chunks: 0, indexingTimeSeconds: 0 },
                }));
                showToast("Index cleared");
              }}
            />
          )}

          {screen === "indexing" && (
            <IndexingScreen
              steps={indexingSteps}
              stats={workspace.status !== "not-indexed" ? workspace.stats : null}
              isComplete={workspace.status === "indexed" && !isIndexing}
              isRunning={isIndexing}
              onStart={runIndexing}
              onGoToSearch={() => setScreen("search")}
            />
          )}

          {screen === "history" && (
            <HistoryScreen
              entries={history}
              onSearchAgain={(q) => {
                setQuery(q);
                setScreen("search");
                runSearch(q);
              }}
              onClear={() => {
                setHistory([]);
                vscode.postMessage({ type: "clearHistory" });
              }}
            />
          )}

          {screen === "settings" && (
            <SettingsScreen
              settings={settings}
              onTopKChange={(n) => {
                setSettings((s) => ({ ...s, topK: n }));
                setTopK(n);
                vscode.postMessage({ type: "updateSetting", key: "topK", value: n });
              }}
              onToggleLanguage={(lang) => {
                setSettings((s) => ({
                  ...s,
                  supportedLanguages: {
                    ...s.supportedLanguages,
                    [lang]: !s.supportedLanguages[lang],
                  },
                }));
                vscode.postMessage({
                  type: "updateSetting",
                  key: "supportedLanguages",
                  value: { ...settings.supportedLanguages, [lang]: !settings.supportedLanguages[lang] },
                });
              }}
            />
          )}
        </main>
      </div>
      <Toast message={toast} />
    </div>
  );
}
