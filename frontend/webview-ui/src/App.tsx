import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { defaultSettings, emptyWorkspace, indexingStepsTemplate, suggestedQueries } from "./data/defaults";
import type {
  HistoryEntry,
  IndexingStepState,
  IndexProgress,
  ScreenId,
  SearchResult,
  Settings,
  WorkspaceInfo,
} from "./data/types";
import type { InboundMessage, OutboundMessage } from "./messaging";
import { getVsCodeApi } from "./vscodeApi";
import { HistoryScreen } from "./screens/HistoryScreen";
import { IndexingScreen } from "./screens/IndexingScreen";
import { SearchScreen } from "./screens/SearchScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

const vscode = getVsCodeApi();
const send = (m: OutboundMessage) => vscode.postMessage(m);

function freshSteps(): IndexingStepState[] {
  return indexingStepsTemplate.map((s) => ({ ...s, status: "pending" as const }));
}

function stepsFor(progress: IndexProgress): IndexingStepState[] {
  const order = indexingStepsTemplate.map((s) => s.id);
  const at = order.indexOf(progress.phase);
  return indexingStepsTemplate.map((s, i) => ({
    ...s,
    status: progress.phase === "done" || i < at ? "done" : i === at ? "active" : "pending",
  }));
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("welcome");
  const [workspace, setWorkspace] = useState<WorkspaceInfo>(emptyWorkspace);

  const [indexingSteps, setIndexingSteps] = useState<IndexingStepState[]>(freshSteps());
  const [progress, setProgress] = useState<IndexProgress | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(defaultSettings.topK);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [resultsLabel, setResultsLabel] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [toast, setToast] = useState<string | null>(null);

  const requestId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- messages from the extension host
  useEffect(() => {
    function onMessage(event: MessageEvent<InboundMessage>) {
      const msg = event.data;
      if (!msg || typeof msg !== "object" || !("type" in msg)) return;
      switch (msg.type) {
        case "workspaceInfo":
          setWorkspace(msg.workspace);
          if (msg.workspace.status === "indexed") setIndexError(null);
          break;
        case "indexProgress":
          setProgress(msg.progress);
          setIndexingSteps(stepsFor(msg.progress));
          setIndexError(null);
          break;
        case "indexError":
          setIndexError(msg.message);
          break;
        case "searchResults":
          if (msg.requestId !== requestId.current) return; // a newer search is in flight
          setResults(msg.results);
          setElapsedMs(msg.elapsedMs);
          setResultsLabel(null);
          setSearchError(null);
          setIsSearching(false);
          break;
        case "searchError":
          if (msg.requestId !== requestId.current) return;
          setSearchError(msg.message);
          setResults(null);
          setIsSearching(false);
          break;
        case "externalSearch":
          setScreen("search");
          setSelectedResult(null);
          setQuery("");
          setResults(msg.results);
          setResultsLabel(msg.label);
          setElapsedMs(msg.elapsedMs);
          setSearchError(null);
          setIsSearching(false);
          break;
        case "historyUpdated":
          setHistory(msg.history);
          break;
        case "settings":
          setSettings(msg.settings);
          setTopK(msg.settings.topK);
          break;
        case "openFileAck":
          if (!msg.ok) showToast(`Could not open ${msg.file}`);
          break;
        case "focusSearch":
          setScreen("search");
          setSelectedResult(null);
          setFocusToken((n) => n + 1);
          break;
      }
    }
    window.addEventListener("message", onMessage);
    send({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [showToast]);

  const runIndexing = useCallback(() => {
    setScreen("indexing");
    setIndexError(null);
    setIndexingSteps(freshSteps());
    setProgress(null);
    send({ type: "indexWorkspace" });
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 3) return;
      const id = ++requestId.current;
      setIsSearching(true);
      setSearchError(null);
      setSelectedResult(null);
      setResultsLabel(null);
      send({ type: "search", query: trimmed, topK, requestId: id });
    },
    [topK]
  );

  const handleOpenInEditor = useCallback(
    (result: SearchResult) => {
      send({ type: "openFile", file: result.file, startLine: result.startLine, endLine: result.endLine });
      showToast(`Opening ${result.file}:${result.startLine}`);
    },
    [showToast]
  );

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    if (key === "topK") setTopK(value as number);
    send({ type: "updateSetting", key, value });
  }, []);

  const isIndexing = workspace.status === "indexing";
  const canSearch = workspace.status === "indexed" || workspace.engine === "backend";

  return (
    <div className="sc-app">
      <Header workspace={workspace} />
      <div className="sc-body">
        <Sidebar active={screen} onSelect={setScreen} />
        <main className="sc-content">
          {screen === "welcome" && (
            <WelcomeScreen
              workspace={workspace}
              onIndexWorkspace={runIndexing}
              onSearchCode={() => setScreen("search")}
            />
          )}

          {screen === "search" && (
            <SearchScreen
              workspace={workspace}
              canSearch={canSearch}
              onIndexWorkspace={runIndexing}
              query={query}
              onQueryChange={setQuery}
              onSubmit={() => runSearch(query)}
              topK={topK}
              onTopKChange={setTopK}
              isSearching={isSearching}
              results={results}
              resultsLabel={resultsLabel}
              elapsedMs={elapsedMs}
              error={searchError}
              selectedResult={selectedResult}
              onView={setSelectedResult}
              onClosePreview={() => setSelectedResult(null)}
              onOpenInEditor={handleOpenInEditor}
              suggestedQueries={suggestedQueries}
              onPickSuggested={(q) => {
                setQuery(q);
                runSearch(q);
              }}
              focusToken={focusToken}
            />
          )}

          {screen === "workspace" && (
            <WorkspaceScreen
              workspace={workspace}
              onReindex={runIndexing}
              onClearIndex={() => {
                setResults(null);
                setSelectedResult(null);
                setIndexingSteps(freshSteps());
                setProgress(null);
                send({ type: "clearIndex" });
                showToast("Index cleared");
              }}
            />
          )}

          {screen === "indexing" && (
            <IndexingScreen
              steps={indexingSteps}
              progress={progress}
              error={indexError}
              stats={workspace.status === "indexed" ? workspace.stats : null}
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
              onClear={() => send({ type: "clearHistory" })}
            />
          )}

          {screen === "settings" && (
            <SettingsScreen
              settings={settings}
              onChange={updateSetting}
              onOpenVsCodeSettings={() => send({ type: "openSettingsJson" })}
            />
          )}
        </main>
      </div>
      <Toast message={toast} />
    </div>
  );
}
