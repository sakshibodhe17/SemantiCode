import type { WorkspaceInfo } from "../data/types";
import { WorkspaceInfoPanel } from "../components/WorkspaceInfo";

export function WorkspaceScreen({
  workspace,
  onReindex,
  onClearIndex,
}: {
  workspace: WorkspaceInfo;
  onReindex: () => void;
  onClearIndex: () => void;
}) {
  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Workspace</h2>
        <p className="sc-fg-muted">The current VS Code workspace is treated as the repository.</p>
      </div>
      <WorkspaceInfoPanel workspace={workspace} onReindex={onReindex} onClearIndex={onClearIndex} />
    </div>
  );
}
