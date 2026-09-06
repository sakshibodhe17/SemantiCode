import type { IndexingStepState, IndexStats } from "../data/types";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

export function IndexingProgress({
  steps,
  stats,
  isComplete,
}: {
  steps: IndexingStepState[];
  stats: IndexStats | null;
  isComplete: boolean;
}) {
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
          </li>
        ))}
      </ol>

      {stats && (
        <div className="sc-indexing__stats">
          <div className="sc-stat-grid">
            <Stat label="Files" value={stats.files} />
            <Stat label="Functions" value={stats.functions} />
            <Stat label="Classes" value={stats.classes} />
            <Stat label="Code chunks" value={stats.chunks} />
          </div>
          <div className="sc-indexing__footer">
            <span className="sc-fg-faint">
              Indexing time: <span className="sc-mono">{stats.indexingTimeSeconds}s</span>
            </span>
            {isComplete && <StatusBadge kind="indexed" />}
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
