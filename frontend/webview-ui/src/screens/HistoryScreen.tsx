import type { HistoryEntry } from "../data/types";
import { SearchHistory } from "../components/SearchHistory";

export function HistoryScreen({
  entries,
  onSearchAgain,
  onClear,
}: {
  entries: HistoryEntry[];
  onSearchAgain: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Search History</h2>
        <p className="sc-fg-muted">Previous queries in this workspace.</p>
      </div>
      <SearchHistory entries={entries} onSearchAgain={onSearchAgain} onClear={onClear} />
    </div>
  );
}
