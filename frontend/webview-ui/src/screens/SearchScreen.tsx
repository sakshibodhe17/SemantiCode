import type { SearchResult, WorkspaceInfo } from "../data/types";
import { CodePreview } from "../components/CodePreview";
import { SearchInput, SuggestedQueries } from "../components/SearchInput";
import { SearchResults } from "../components/SearchResults";

export function SearchScreen({
  workspace,
  query,
  onQueryChange,
  onSubmit,
  topK,
  onTopKChange,
  isSearching,
  results,
  selectedResult,
  onView,
  onClosePreview,
  onOpenInEditor,
  suggestedQueries,
  onPickSuggested,
}: {
  workspace: WorkspaceInfo;
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  topK: number;
  onTopKChange: (n: number) => void;
  isSearching: boolean;
  results: SearchResult[] | null;
  selectedResult: SearchResult | null;
  onView: (result: SearchResult) => void;
  onClosePreview: () => void;
  onOpenInEditor: (result: SearchResult) => void;
  suggestedQueries: string[];
  onPickSuggested: (q: string) => void;
}) {
  if (selectedResult) {
    return (
      <div className="sc-screen">
        <CodePreview
          result={selectedResult}
          onClose={onClosePreview}
          onOpenInEditor={onOpenInEditor}
        />
      </div>
    );
  }

  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Semantic Code Search</h2>
        <p className="sc-fg-muted">Search your codebase using natural language.</p>
      </div>

      <SearchInput
        value={query}
        onChange={onQueryChange}
        onSubmit={onSubmit}
        workspaceName={workspace.name}
        topK={topK}
        onTopKChange={onTopKChange}
        isSearching={isSearching}
      />

      {results === null && !isSearching && (
        <SuggestedQueries queries={suggestedQueries} onPick={onPickSuggested} />
      )}

      <SearchResults
        results={results}
        isSearching={isSearching}
        query={query}
        onView={onView}
      />
    </div>
  );
}
