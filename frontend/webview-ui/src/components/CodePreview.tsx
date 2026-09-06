import type { SearchResult } from "../data/types";
import { CodeViewer } from "./CodeViewer";
import { Icon } from "./Icon";
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
            <span className="sc-fg-faint">()</span>
          </div>
        </div>
        <button type="button" className="sc-icon-btn" aria-label="Close preview" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="sc-preview__meta">
        <SimilarityScore value={result.similarity} />
        <span className="sc-fg-faint">
          Lines {result.startLine}–{result.endLine}
        </span>
      </div>

      <div className="sc-preview__code">
        <CodeViewer code={result.code} startLine={result.startLine} />
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
