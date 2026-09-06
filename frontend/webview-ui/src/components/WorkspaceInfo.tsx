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

      <div className="sc-actions">
        <button type="button" className="sc-btn sc-btn--secondary" onClick={onReindex}>
          Re-index Workspace
        </button>
        <button type="button" className="sc-btn sc-btn--danger-outline" onClick={onClearIndex}>
          Clear Index
        </button>
      </div>

      <p className="sc-note">
        SemantiCode indexes the folder currently open in VS Code — there's no
        need to zip or upload your project. Importing an external
        repository/ZIP is planned as a secondary, optional capability (see
        project scope).
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
