import type { IndexingStepState, IndexProgress, WorkspaceStats } from "../data/types";
import { IndexingProgress } from "../components/IndexingProgress";
import { ErrorState } from "../components/EmptyState";
import { Icon } from "../components/Icon";

export function IndexingScreen({
  steps,
  progress,
  error,
  stats,
  isComplete,
  isRunning,
  onStart,
  onGoToSearch,
}: {
  steps: IndexingStepState[];
  progress: IndexProgress | null;
  error: string | null;
  stats: WorkspaceStats | null;
  isComplete: boolean;
  isRunning: boolean;
  onStart: () => void;
  onGoToSearch: () => void;
}) {
  const showProgress = isRunning || progress !== null || isComplete;
  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Index Workspace</h2>
        <p className="sc-fg-muted">
          Scans the open folder, extracts functions, methods and classes, and builds a local
          BM25F index. Re-indexing only re-parses files that changed.
        </p>
      </div>

      {error && <ErrorState title="Indexing failed" description={error} onRetry={onStart} />}

      {!isRunning && !error && (
        <button type="button" className="sc-btn sc-btn--primary" onClick={onStart}>
          <Icon name="index" size={14} />
          {isComplete ? "Re-index Workspace" : "Start Indexing"}
        </button>
      )}

      {showProgress && !error && (
        <IndexingProgress steps={isComplete && !progress ? steps.map((s) => ({ ...s, status: "done" })) : steps} progress={progress} stats={stats} isComplete={isComplete} />
      )}

      {isComplete && (
        <button type="button" className="sc-btn sc-btn--secondary" onClick={onGoToSearch}>
          <Icon name="search" size={14} />
          Continue to Search
        </button>
      )}
    </div>
  );
}
