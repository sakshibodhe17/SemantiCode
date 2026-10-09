import type { SearchResult as SearchResultType } from "../data/types";
import { SearchResult } from "./SearchResult";
import { EmptyState, LoadingState } from "./EmptyState";

export function SearchResults({
  results,
  label,
  elapsedMs,
  isSearching,
  query,
  onView,
  onOpen,
}: {
  results: SearchResultType[] | null;
  label: string | null;
  elapsedMs: number | null;
  isSearching: boolean;
  query: string;
  onView: (result: SearchResultType) => void;
  onOpen: (result: SearchResultType) => void;
}) {
  if (isSearching) return <LoadingState label="Searching workspace…" />;
  if (results === null) return null;

  if (results.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No results"
        description={`Nothing matched "${label ?? query}". Try other words for the same idea, or remove filters.`}
      />
    );
  }

  return (
    <div className="sc-results">
      {label && <div className="sc-results__label">{label}</div>}
      <div className="sc-results__header">
        <span>SEARCH RESULTS</span>
        <span className="sc-fg-faint">
          {results.length} results{elapsedMs !== null ? ` · ${elapsedMs} ms` : ""}
        </span>
      </div>
      <ul className="sc-results__list">
        {results.map((r) => (
          <SearchResult key={r.id} result={r} onView={onView} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}
