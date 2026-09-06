import type { ReactNode } from "react";
import type { SemantiCodeSettings } from "../data/types";

export function SettingsPanel({
  settings,
  onTopKChange,
  onToggleLanguage,
}: {
  settings: SemantiCodeSettings;
  onTopKChange: (n: number) => void;
  onToggleLanguage: (lang: string) => void;
}) {
  return (
    <div className="sc-settings">
      <Section title="Embedding Model">
        <ReadonlyRow label="Model" value={settings.embeddingModel} />
        <ReadonlyRow label="Model version" value={settings.modelVersion} mono />
      </Section>

      <Section title="Vector Search">
        <ReadonlyRow label="Engine" value={settings.vectorSearchEngine} />
        <ReadonlyRow label="Similarity metric" value={settings.similarityMetric} />
      </Section>

      <Section title="Search Behavior">
        <div className="sc-settings__row">
          <label className="sc-field-label" htmlFor="topk-input">
            Top-K results
          </label>
          <input
            id="topk-input"
            type="number"
            min={1}
            max={50}
            className="sc-input sc-input--number"
            value={settings.topK}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onTopKChange(Math.min(50, Math.max(1, n)));
            }}
          />
        </div>
        <p className="sc-field-hint">Default number of results returned per search (1–50).</p>
      </Section>

      <Section title="Supported Languages">
        <div className="sc-lang-grid">
          {Object.entries(settings.supportedLanguages).map(([lang, enabled]) => (
            <label key={lang} className="sc-checkbox">
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => onToggleLanguage(lang)}
              />
              {lang}
            </label>
          ))}
        </div>
      </Section>

      <p className="sc-note">
        These are configuration placeholders for this milestone. In the full
        implementation they read/write real VS Code settings
        (<code className="sc-mono">semanticode.*</code> in{" "}
        <code className="sc-mono">settings.json</code>) and are consumed by
        the FastAPI backend when a search or indexing request is made.
      </p>
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

function ReadonlyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="sc-settings__row">
      <span className="sc-field-label">{label}</span>
      <span className={mono ? "sc-mono" : undefined}>{value}</span>
    </div>
  );
}
