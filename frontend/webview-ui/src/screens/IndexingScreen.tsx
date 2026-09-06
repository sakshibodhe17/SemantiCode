import type { IndexingStepState, IndexStats } from "../data/types";
import { IndexingProgress } from "../components/IndexingProgress";
import { Icon } from "../components/Icon";

export function IndexingScreen({
  steps,
  stats,
  isComplete,
  isRunning,
  onStart,
  onGoToSearch,
}: {
  steps: IndexingStepState[];
  stats: IndexStats | null;
  isComplete: boolean;
  isRunning: boolean;
  onStart: () => void;
  onGoToSearch: () => void;
}) {
  const notStarted = !isRunning && !isComplete;

  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Index Workspace</h2>
        <p className="sc-fg-muted">
          Scans the workspace, parses code with Tree-sitter, and builds
          embeddings + a FAISS vector index. Simulated for this milestone.
        </p>
      </div>

      {notStarted && (
        <button type="button" className="sc-btn sc-btn--primary" onClick={onStart}>
          <Icon name="index" size={14} />
          Start Indexing
        </button>
      )}

      {(isRunning || isComplete) && (
        <IndexingProgress steps={steps} stats={stats} isComplete={isComplete} />
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
