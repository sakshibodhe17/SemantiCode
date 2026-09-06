import type { SearchResult as SearchResultType } from "../data/types";
import { SearchResult } from "./SearchResult";
import { EmptyState, LoadingState } from "./EmptyState";

export function SearchResults({
  results,
  isSearching,
  query,
  onView,
}: {
  results: SearchResultType[] | null;
  isSearching: boolean;
  query: string;
  onView: (result: SearchResultType) => void;
}) {
  if (isSearching) {
    return <LoadingState label="Searching workspace…" />;
  }

  if (results === null) {
    return null;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No results"
        description={`Nothing matched "${query}". Try describing the behavior differently.`}
      />
    );
  }

  return (
    <div className="sc-results">
      <div className="sc-results__header">
        <span>SEARCH RESULTS</span>
        <span className="sc-fg-faint">{results.length} results</span>
      </div>
      <ul className="sc-results__list">
        {results.map((r) => (
          <SearchResult key={r.id} result={r} onView={onView} />
        ))}
      </ul>
    </div>
  );
}
