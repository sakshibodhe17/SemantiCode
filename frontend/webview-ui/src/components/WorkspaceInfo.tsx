import type { WorkspaceInfo as WorkspaceInfoType } from "../data/types";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";

export function WorkspaceInfoPanel({
  workspace,
  onReindex,
  onClearIndex,
}: {
  workspace: WorkspaceInfoType;
  onReindex: () => void;
  onClearIndex: () => void;
}) {
  return (
    <div className="sc-workspace-card">
      <div className="sc-workspace-card__title">
        <Icon name="workspace" size={16} />
        <span className="sc-mono">{workspace.name}</span>
      </div>

      <dl className="sc-kv">
        <div className="sc-kv__row">
          <dt>Path</dt>
          <dd className="sc-mono sc-truncate" title={workspace.path}>
            {workspace.path}
          </dd>
        </div>
        <div className="sc-kv__row">
          <dt>Primary language</dt>
          <dd>{workspace.primaryLanguage}</dd>
        </div>
        <div className="sc-kv__row">
          <dt>Status</dt>
          <dd>
            <StatusBadge
              kind={
                workspace.status === "indexed"
                  ? "indexed"
                  : workspace.status === "indexing"
                  ? "indexing"
                  : "not-indexed"
              }
              label={workspace.status === "indexed" ? "Indexed" : undefined}
            />
          </dd>
        </div>
        <div className="sc-kv__row">
          <dt>Engine</dt>
          <dd>{workspace.engine === "backend" ? "FastAPI backend" : "Local (offline)"}</dd>
        </div>
        {workspace.stats.indexingTimeSeconds > 0 && (
          <div className="sc-kv__row">
            <dt>Index time</dt>
            <dd className="sc-mono">{workspace.stats.indexingTimeSeconds}s</dd>
          </div>
        )}
        {workspace.lastIndexedAt && (
          <div className="sc-kv__row">
            <dt>Last indexed</dt>
            <dd>{new Date(workspace.lastIndexedAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      <div className="sc-stat-grid">
        <MiniStat label="files" value={workspace.stats.files} />
        <MiniStat label="functions" value={workspace.stats.functions} />
        <MiniStat label="classes" value={workspace.stats.classes} />
        <MiniStat label="chunks" value={workspace.stats.chunks} />
      </div>

      {Object.keys(workspace.stats.languages).length > 0 && (
        <div className="sc-langs">
          {Object.entries(workspace.stats.languages)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, n]) => (
              <span key={lang} className="sc-chip">{lang} · {n}</span>
            ))}
        </div>
      )}

      <div className="sc-actions">
        <button type="button" className="sc-btn sc-btn--secondary" onClick={onReindex} disabled={workspace.status === "indexing"}>
          Re-index Workspace
        </button>
        <button type="button" className="sc-btn sc-btn--danger-outline" onClick={onClearIndex} disabled={workspace.status !== "indexed"}>
          Clear Index
        </button>
      </div>

      <p className="sc-note">
        SemantiCode indexes the folder currently open in VS Code — no zipping or
        uploading. The index is stored locally in VS Code's workspace storage and
        is updated automatically when you save a file.
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="sc-stat">
      <div className="sc-stat__value sc-mono">{value.toLocaleString()}</div>
      <div className="sc-stat__label">{label}</div>
    </div>
  );
}
