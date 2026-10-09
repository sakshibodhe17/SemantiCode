import type { Settings } from "../data/types";
import { SettingsPanel } from "../components/SettingsPanel";

export function SettingsScreen({
  settings,
  onChange,
  onOpenVsCodeSettings,
}: {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onOpenVsCodeSettings: () => void;
}) {
  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Settings</h2>
        <p className="sc-fg-muted">Stored as real VS Code settings (<span className="sc-mono">semanticode.*</span>).</p>
      </div>
      <SettingsPanel settings={settings} onChange={onChange} onOpenVsCodeSettings={onOpenVsCodeSettings} />
    </div>
  );
}
