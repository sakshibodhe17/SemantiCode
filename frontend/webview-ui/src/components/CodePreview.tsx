import type { SearchResult } from "../data/types";
import { CodeViewer } from "./CodeViewer";
import { Icon } from "./Icon";
import { MatchedTerms } from "./MatchedTerms";
import { SimilarityScore } from "./SimilarityScore";

export function CodePreview({
  result,
  onClose,
  onOpenInEditor,
}: {
  result: SearchResult;
  onClose: () => void;
  onOpenInEditor: (result: SearchResult) => void;
}) {
  return (
    <div className="sc-preview" role="dialog" aria-label={`Preview of ${result.name}`}>
      <div className="sc-preview__header">
        <div>
          <div className="sc-preview__file">
            <Icon name="file" size={13} />
            <span className="sc-mono">{result.file}</span>
          </div>
          <div className="sc-preview__symbol sc-mono">
            {result.className && (
              <span className="sc-result__class">{result.className}.</span>
            )}
            {result.name}
            {result.kind !== "class" && result.kind !== "block" && <span className="sc-fg-faint">()</span>}
          </div>
        </div>
        <button type="button" className="sc-icon-btn" aria-label="Close preview" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="sc-preview__meta">
        <SimilarityScore value={result.similarity} />
        <span className="sc-fg-faint">
          Lines {result.startLine}–{result.endLine} · {result.language} {result.kind}
        </span>
      </div>
      <div className="sc-preview__why">
        <span className="sc-field-label">Matched</span>
        <MatchedTerms terms={result.matched} />
      </div>

      <div className="sc-preview__code">
        <CodeViewer code={result.code} startLine={result.startLine} language={result.language} highlightTerms={result.matched.map((m) => m.term)} />
        {result.endLine - result.startLine + 1 > result.code.length && (
          <div className="sc-field-hint">… {result.endLine - result.startLine + 1 - result.code.length} more lines — open in editor to see all.</div>
        )}
      </div>

      <div className="sc-preview__actions">
        <button
          type="button"
          className="sc-btn sc-btn--primary"
          onClick={() => onOpenInEditor(result)}
        >
          <Icon name="openExternal" size={13} />
          Open in Editor
        </button>
        <button type="button" className="sc-btn sc-btn--secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
