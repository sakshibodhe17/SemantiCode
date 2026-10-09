import type { SearchResult as SearchResultType } from "../data/types";
import { Icon } from "./Icon";
import { MatchedTerms } from "./MatchedTerms";
import { SimilarityScore } from "./SimilarityScore";

export function SearchResult({
  result,
  onView,
  onOpen,
}: {
  result: SearchResultType;
  onView: (result: SearchResultType) => void;
  onOpen: (result: SearchResultType) => void;
}) {
  return (
    <li className="sc-result">
      <button
        type="button"
        className="sc-result__main"
        onClick={() => onView(result)}
        onDoubleClick={() => onOpen(result)}
        title="Click to preview · double-click to open in editor"
      >
        <SimilarityScore value={result.similarity} />
        <div className="sc-result__symbol">
          <span className="sc-mono sc-result__name">
            {result.className && <span className="sc-result__class">{result.className}.</span>}
            {result.name}
            {result.kind !== "class" && result.kind !== "block" && <span className="sc-fg-faint">()</span>}
            <span className="sc-kind">{result.kind}</span>
          </span>
          <span className="sc-result__location" title={result.file}>
            <Icon name="file" size={12} />
            <span className="sc-mono">{result.file}</span>
          </span>
          <span className="sc-fg-faint">
            Lines {result.startLine}–{result.endLine}
          </span>
          <MatchedTerms terms={result.matched} />
        </div>
        <Icon name="chevronRight" size={14} />
      </button>
    </li>
  );
}
