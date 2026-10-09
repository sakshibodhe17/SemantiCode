import type { SearchResult, WorkspaceInfo } from "../data/types";
import { CodePreview } from "../components/CodePreview";
import { EmptyState, ErrorState } from "../components/EmptyState";
import { SearchInput, SuggestedQueries } from "../components/SearchInput";
import { SearchResults } from "../components/SearchResults";

export function SearchScreen(props: {
  workspace: WorkspaceInfo;
  canSearch: boolean;
  onIndexWorkspace: () => void;
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  topK: number;
  onTopKChange: (n: number) => void;
  isSearching: boolean;
  results: SearchResult[] | null;
  resultsLabel: string | null;
  elapsedMs: number | null;
  error: string | null;
  selectedResult: SearchResult | null;
  onView: (result: SearchResult) => void;
  onClosePreview: () => void;
  onOpenInEditor: (result: SearchResult) => void;
  suggestedQueries: string[];
  onPickSuggested: (q: string) => void;
  focusToken: number;
}) {
  const p = props;
  if (p.selectedResult) {
    return (
      <div className="sc-screen">
        <CodePreview result={p.selectedResult} onClose={p.onClosePreview} onOpenInEditor={p.onOpenInEditor} />
      </div>
    );
  }

  if (!p.canSearch) {
    return (
      <div className="sc-screen">
        <EmptyState
          icon="index"
          title={p.workspace.status === "indexing" ? "Indexing in progress…" : "Index this workspace first"}
          description="SemantiCode searches a local index of your functions and classes. Building it takes a few seconds."
          action={
            p.workspace.status !== "indexing" && (
              <button type="button" className="sc-btn sc-btn--primary" onClick={p.onIndexWorkspace}>
                Index Workspace
              </button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Semantic Code Search</h2>
        <p className="sc-fg-muted">Describe what the code does. Filters: <span className="sc-mono">lang:py in:src/ kind:class</span></p>
      </div>

      <SearchInput
        value={p.query}
        onChange={p.onQueryChange}
        onSubmit={p.onSubmit}
        workspaceName={p.workspace.name}
        topK={p.topK}
        onTopKChange={p.onTopKChange}
        isSearching={p.isSearching}
        focusToken={p.focusToken}
      />

      {p.error && <ErrorState title="Search failed" description={p.error} onRetry={p.onSubmit} />}

      {p.results === null && !p.isSearching && !p.error && (
        <SuggestedQueries queries={p.suggestedQueries} onPick={p.onPickSuggested} />
      )}

      {!p.error && (
        <SearchResults
          results={p.results}
          label={p.resultsLabel}
          elapsedMs={p.elapsedMs}
          isSearching={p.isSearching}
          query={p.query}
          onView={p.onView}
          onOpen={p.onOpenInEditor}
        />
      )}
    </div>
  );
}
