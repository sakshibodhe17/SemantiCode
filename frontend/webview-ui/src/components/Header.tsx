import type { WorkspaceInfo } from "../data/types";
import { StatusBadge } from "./StatusBadge";

export function Header({ workspace }: { workspace: WorkspaceInfo }) {
  return (
    <header className="sc-header">
      <div className="sc-header__brand">
        <span className="sc-header__mark">◆</span>
        <div>
          <div className="sc-header__title">SemantiCode</div>
          <div className="sc-header__subtitle">Search code by what it does.</div>
        </div>
      </div>
      <div className="sc-header__workspace" title={workspace.path}>
        <span className="sc-header__workspace-name">{workspace.name}</span>
        <StatusBadge
          kind={
            workspace.status === "indexed"
              ? "indexed"
              : workspace.status === "indexing"
              ? "indexing"
              : workspace.status === "error"
              ? "error"
              : "not-indexed"
          }
        />
      </div>
    </header>
  );
}
