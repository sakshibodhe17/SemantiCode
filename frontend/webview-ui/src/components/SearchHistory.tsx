import type { HistoryEntry } from "../data/types";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString();
}

export function SearchHistory({
  entries,
  onSearchAgain,
  onClear,
}: {
  entries: HistoryEntry[];
  onSearchAgain: (query: string) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="history"
        title="No searches yet"
        description="Queries you run will show up here so you can re-run them later."
      />
    );
  }

  return (
    <div className="sc-history">
      <div className="sc-results__header">
        <span>SEARCH HISTORY</span>
        <button type="button" className="sc-link-btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul className="sc-history__list">
        {entries.map((entry) => (
          <li key={entry.id} className="sc-history__item">
            <div className="sc-history__query">"{entry.query}"</div>
            <div className="sc-history__meta">
              <span className="sc-mono">{entry.workspace}</span>
              <span className="sc-fg-faint">·</span>
              <span className="sc-fg-faint">{formatTimestamp(entry.timestamp)}</span>
              <span className="sc-fg-faint">·</span>
              <span className="sc-fg-faint">{entry.resultCount} results</span>
            </div>
            <button
              type="button"
              className="sc-btn sc-btn--secondary sc-btn--sm"
              onClick={() => onSearchAgain(entry.query)}
            >
              <Icon name="search" size={11} />
              Search Again
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
