import type { ReactNode } from "react";
import type { Settings } from "../data/types";

export function SettingsPanel({
  settings,
  onChange,
  onOpenVsCodeSettings,
}: {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onOpenVsCodeSettings: () => void;
}) {
  return (
    <div className="sc-settings">
      <Section title="Search Engine">
        <div className="sc-settings__row">
          <label className="sc-field-label" htmlFor="engine-select">Engine</label>
          <select
            id="engine-select"
            className="sc-select"
            value={settings.engine}
            onChange={(e) => onChange("engine", e.target.value as Settings["engine"])}
          >
            <option value="local">Local (built-in, offline)</option>
            <option value="backend">FastAPI backend</option>
          </select>
        </div>
        <ReadonlyRow label="Ranking" value={settings.rankingModel} />
        {settings.engine === "backend" && (
          <div className="sc-settings__row">
            <label className="sc-field-label" htmlFor="backend-url">Backend URL</label>
            <input
              id="backend-url"
              className="sc-input sc-mono"
              defaultValue={settings.backendUrl}
              onBlur={(e) => onChange("backendUrl", e.target.value.trim())}
            />
          </div>
        )}
        <Toggle
          label="Concept expansion (auth ↔ login ↔ jwt …)"
          checked={settings.queryExpansion}
          onChange={(v) => onChange("queryExpansion", v)}
        />
        <Toggle
          label="Re-index files automatically on save"
          checked={settings.autoIndexOnSave}
          onChange={(v) => onChange("autoIndexOnSave", v)}
        />
      </Section>

      <Section title="Search Behavior">
        <div className="sc-settings__row">
          <label className="sc-field-label" htmlFor="topk-input">Top-K results</label>
          <input
            id="topk-input"
            type="number"
            min={1}
            max={50}
            className="sc-input sc-input--number"
            value={settings.topK}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange("topK", Math.min(50, Math.max(1, Math.round(n))));
            }}
          />
        </div>
        <p className="sc-field-hint">Default number of results returned per search (1–50).</p>
      </Section>

      <Section title="Languages to index">
        <div className="sc-lang-grid">
          {Object.entries(settings.supportedLanguages).map(([lang, enabled]) => (
            <label key={lang} className="sc-checkbox">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() =>
                  onChange("supportedLanguages", { ...settings.supportedLanguages, [lang]: !enabled })
                }
              />
              {lang}
            </label>
          ))}
        </div>
        <p className="sc-field-hint">Re-index after changing languages.</p>
      </Section>

      <button type="button" className="sc-btn sc-btn--secondary" onClick={onOpenVsCodeSettings}>
        Open all SemantiCode settings (exclude globs, limits…)
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sc-settings__section">
      <h3 className="sc-settings__section-title">{title}</h3>
      {children}
    </section>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sc-settings__row">
      <span className="sc-field-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sc-checkbox sc-settings__toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
