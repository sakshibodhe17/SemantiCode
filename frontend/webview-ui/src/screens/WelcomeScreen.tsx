import type { WorkspaceInfo } from "../data/types";
import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";

export function WelcomeScreen({
  workspace,
  onIndexWorkspace,
  onSearchCode,
}: {
  workspace: WorkspaceInfo;
  onIndexWorkspace: () => void;
  onSearchCode: () => void;
}) {
  const indexed = workspace.status === "indexed";
  const indexing = workspace.status === "indexing";
  const noFolder = !workspace.path;

  return (
    <div className="sc-screen sc-welcome">
      <div className="sc-welcome__hero">
        <div className="sc-welcome__mark">◆</div>
        <h1 className="sc-welcome__title">Semantic Code Search</h1>
        <p className="sc-welcome__subtitle">Ask about your codebase in plain English and jump straight to the code.</p>
      </div>

      <div className="sc-card">
        <div className="sc-field-label">Workspace</div>
        <div className="sc-welcome__workspace-row">
          <Icon name="workspace" size={15} />
          <span className="sc-mono sc-welcome__workspace-name">{workspace.name}</span>
        </div>
        {noFolder ? (
          <StatusBadge kind="error" label="Open a folder to start" />
        ) : (
          <StatusBadge kind={indexed ? "indexed" : indexing ? "indexing" : "detected"} />
        )}
      </div>

      <div className="sc-card">
        <div className="sc-field-label">Index</div>
        {indexed ? (
          <div className="sc-stat-grid">
            <Stat value={workspace.stats.files} label="source files" />
            <Stat value={workspace.stats.functions} label="functions" />
            <Stat value={workspace.stats.chunks} label="code units" />
          </div>
        ) : (
          <p className="sc-field-hint">
            Not indexed yet. Indexing reads the source files in this folder, splits them into
            functions and classes, and builds a local search index. Nothing leaves your machine.
          </p>
        )}
      </div>

      <div className="sc-actions sc-actions--stacked">
        <button type="button" className="sc-btn sc-btn--primary" onClick={onIndexWorkspace} disabled={noFolder || indexing}>
          <Icon name="index" size={14} />
          {indexing ? "Indexing…" : indexed ? "Re-index Workspace" : "Index Workspace"}
        </button>
        <button
          type="button"
          className="sc-btn sc-btn--secondary"
          onClick={onSearchCode}
          disabled={!indexed && workspace.engine !== "backend"}
          title={indexed ? undefined : "Index the workspace first"}
        >
          <Icon name="search" size={14} />
          Search Code
        </button>
      </div>
      <p className="sc-field-hint">
        Tip: <span className="sc-mono">Ctrl+Alt+Shift+F</span> opens Quick Search from anywhere; right-click
        selected code → <em>Find Similar Code</em>.
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="sc-stat">
      <div className="sc-stat__value sc-mono">{value.toLocaleString()}</div>
      <div className="sc-stat__label">{label}</div>
    </div>
  );
}
