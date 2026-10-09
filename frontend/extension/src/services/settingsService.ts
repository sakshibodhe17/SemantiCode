// Read/write bridge to the `semanticode.*` settings contributed in
// package.json. Every value shown on the Settings screen is a real VS Code
// setting, so it can also be edited from settings.json / the Settings UI.

import * as vscode from "vscode";
import { ALL_LANGUAGES } from "../engine/chunker";
import type { Settings } from "../shared/protocol";

const SECTION = "semanticode";

export const DEFAULT_EXCLUDES = [
  "**/node_modules/**", "**/.git/**", "**/dist/**", "**/out/**", "**/build/**",
  "**/.venv/**", "**/venv/**", "**/env/**", "**/__pycache__/**", "**/.next/**",
  "**/target/**", "**/coverage/**", "**/vendor/**", "**/*.min.js", "**/*.bundle.js",
];

function cfg() {
  return vscode.workspace.getConfiguration(SECTION);
}

export function enabledLanguages(): string[] {
  return cfg().get<string[]>("supportedLanguages", ALL_LANGUAGES);
}

export function excludeGlobs(): string[] {
  return [...DEFAULT_EXCLUDES, ...cfg().get<string[]>("exclude", [])];
}

export function maxFiles(): number {
  return Math.max(1, cfg().get<number>("maxFiles", 5000));
}

export function maxFileSizeBytes(): number {
  return Math.max(1, cfg().get<number>("maxFileSizeKB", 512)) * 1024;
}

export function readSettings(): Settings {
  const c = cfg();
  const enabled = new Set(enabledLanguages().map((l) => l.toLowerCase()));
  const engine = c.get<string>("engine", "local") === "backend" ? "backend" : "local";
  return {
    engine,
    backendUrl: c.get<string>("backendUrl", "http://127.0.0.1:8000"),
    rankingModel:
      engine === "local"
        ? "BM25F + code-aware query expansion (offline)"
        : "FastAPI backend (/api/search)",
    topK: c.get<number>("topK", 10),
    queryExpansion: c.get<boolean>("queryExpansion", true),
    autoIndexOnSave: c.get<boolean>("autoIndexOnSave", true),
    supportedLanguages: Object.fromEntries(ALL_LANGUAGES.map((l) => [l, enabled.has(l.toLowerCase())])),
  };
}

export async function updateSetting(key: keyof Settings, value: unknown): Promise<void> {
  const c = cfg();
  const target = vscode.ConfigurationTarget.Global;
  switch (key) {
    case "topK":
      if (typeof value === "number" && value >= 1 && value <= 50) await c.update("topK", Math.round(value), target);
      return;
    case "queryExpansion":
    case "autoIndexOnSave":
      if (typeof value === "boolean") await c.update(key, value, target);
      return;
    case "engine":
      if (value === "local" || value === "backend") await c.update("engine", value, target);
      return;
    case "backendUrl":
      if (typeof value === "string" && /^https?:\/\//.test(value)) await c.update("backendUrl", value, target);
      return;
    case "supportedLanguages":
      if (value && typeof value === "object") {
        const enabled = Object.entries(value as Record<string, boolean>)
          .filter(([, on]) => on)
          .map(([lang]) => lang);
        await c.update("supportedLanguages", enabled, target);
      }
      return;
    default:
      return; // read-only / derived values
  }
}
