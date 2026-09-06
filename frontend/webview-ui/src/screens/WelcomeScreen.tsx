import type { WorkspaceInfo } from "../data/types";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";

export function WelcomeScreen({
  workspace,
  preIndexFileCount,
  onIndexWorkspace,
  onSearchCode,
}: {
  workspace: WorkspaceInfo;
  preIndexFileCount: number;
  onIndexWorkspace: () => void;
  onSearchCode: () => void;
}) {
  const alreadyIndexed = workspace.status === "indexed";

  return (
    <div className="sc-screen sc-welcome">
      <div className="sc-welcome__hero">
        <div className="sc-welcome__mark">◆</div>
        <h1 className="sc-welcome__title">Semantic Code Search</h1>
        <p className="sc-welcome__subtitle">
          Search your codebase using natural language.
        </p>
      </div>

      <div className="sc-card">
        <div className="sc-field-label">Workspace</div>
        <div className="sc-welcome__workspace-row">
          <Icon name="workspace" size={15} />
          <span className="sc-mono sc-welcome__workspace-name">{workspace.name}</span>
        </div>
        <StatusBadge kind="detected" />
      </div>

      <div className="sc-card">
        <div className="sc-field-label">Statistics</div>
        <div className="sc-stat-grid">
          <div className="sc-stat">
            <div className="sc-stat__value sc-mono">
              {(alreadyIndexed ? workspace.stats.files : preIndexFileCount).toLocaleString()}
            </div>
            <div className="sc-stat__label">source files</div>
          </div>
          {alreadyIndexed && (
            <>
              <div className="sc-stat">
                <div className="sc-stat__value sc-mono">
                  {workspace.stats.functions.toLocaleString()}
                </div>
                <div className="sc-stat__label">functions</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat__value sc-mono">
                  {workspace.stats.chunks.toLocaleString()}
                </div>
                <div className="sc-stat__label">code chunks</div>
              </div>
            </>
          )}
        </div>
        {!alreadyIndexed && (
          <p className="sc-field-hint">
            Function and chunk counts appear once indexing has run.
          </p>
        )}
      </div>

      <div className="sc-actions sc-actions--stacked">
        <button type="button" className="sc-btn sc-btn--primary" onClick={onIndexWorkspace}>
          <Icon name="index" size={14} />
          {alreadyIndexed ? "Re-index Workspace" : "Index Workspace"}
        </button>
        <button
          type="button"
          className="sc-btn sc-btn--secondary"
          onClick={onSearchCode}
          disabled={!alreadyIndexed}
          title={alreadyIndexed ? undefined : "Index the workspace first"}
        >
          <Icon name="search" size={14} />
          Search Code
        </button>
      </div>
    </div>
  );
}
