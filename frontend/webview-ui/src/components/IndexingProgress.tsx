import type { IndexingStepState, IndexProgress, WorkspaceStats } from "../data/types";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

export function IndexingProgress({
  steps,
  progress,
  stats,
  isComplete,
}: {
  steps: IndexingStepState[];
  progress: IndexProgress | null;
  stats: WorkspaceStats | null;
  isComplete: boolean;
}) {
  const pct = progress && progress.phase === "parse" && progress.total ? Math.round((progress.current / progress.total) * 100) : null;
  return (
    <div className="sc-indexing">
      <ol className="sc-indexing__steps">
        {steps.map((step) => (
          <li key={step.id} className={`sc-indexing__step is-${step.status}`}>
            <span className="sc-indexing__marker">
              {step.status === "done" ? (
                <Icon name="check" size={12} />
              ) : step.status === "active" ? (
                <span className="sc-spinner sc-spinner--sm" />
              ) : (
                <Icon name="circle" size={10} />
              )}
            </span>
            {step.label}
            {step.id === "parse" && step.status === "active" && pct !== null && (
              <span className="sc-fg-faint sc-mono"> {progress!.current}/{progress!.total}</span>
            )}
          </li>
        ))}
      </ol>
      {pct !== null && !isComplete && (
        <div className="sc-progressbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="sc-progressbar__fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      {progress && <p className="sc-field-hint sc-truncate" title={progress.message}>{progress.message}</p>}

      {stats && isComplete && (
        <div className="sc-indexing__stats">
          <div className="sc-stat-grid">
            <Stat label="Files" value={stats.files} />
            <Stat label="Functions" value={stats.functions} />
            <Stat label="Classes" value={stats.classes} />
            <Stat label="Code units" value={stats.chunks} />
          </div>
          <div className="sc-indexing__footer">
            <span className="sc-fg-faint">
              Indexing time: <span className="sc-mono">{stats.indexingTimeSeconds}s</span>
            </span>
            <StatusBadge kind="indexed" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="sc-stat">
      <div className="sc-stat__value sc-mono">{value.toLocaleString()}</div>
      <div className="sc-stat__label">{label}</div>
    </div>
  );
}
