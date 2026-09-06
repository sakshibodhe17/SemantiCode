import type { SemantiCodeSettings } from "../data/types";
import { SettingsPanel } from "../components/SettingsPanel";

export function SettingsScreen({
  settings,
  onTopKChange,
  onToggleLanguage,
}: {
  settings: SemantiCodeSettings;
  onTopKChange: (n: number) => void;
  onToggleLanguage: (lang: string) => void;
}) {
  return (
    <div className="sc-screen">
      <div className="sc-screen__heading">
        <h2>Settings</h2>
        <p className="sc-fg-muted">Semantic Code Search configuration.</p>
      </div>
      <SettingsPanel
        settings={settings}
        onTopKChange={onTopKChange}
        onToggleLanguage={onToggleLanguage}
      />
    </div>
  );
}
