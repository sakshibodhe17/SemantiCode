import type { SearchResult as SearchResultType } from "../data/types";
import { Icon } from "./Icon";
import { SimilarityScore } from "./SimilarityScore";

export function SearchResult({
  result,
  onView,
}: {
  result: SearchResultType;
  onView: (result: SearchResultType) => void;
}) {
  return (
    <li className="sc-result">
      <button type="button" className="sc-result__main" onClick={() => onView(result)}>
        <SimilarityScore value={result.similarity} />
        <div className="sc-result__symbol">
          <span className="sc-mono sc-result__name">
            {result.className && (
              <span className="sc-result__class">{result.className}.</span>
            )}
            {result.name}
            <span className="sc-fg-faint">()</span>
          </span>
          <span className="sc-result__location" title={result.file}>
            <Icon name="file" size={12} />
            <span className="sc-mono">{result.file}</span>
          </span>
          <span className="sc-fg-faint">
            Lines {result.startLine}–{result.endLine}
          </span>
        </div>
        <Icon name="chevronRight" size={14} />
      </button>
    </li>
  );
}
