import { Icon } from "./Icon";

export type StatusKind = "detected" | "indexed" | "indexing" | "not-indexed" | "error";

const CONFIG: Record<StatusKind, { label: string; className: string }> = {
  detected: { label: "Workspace detected", className: "sc-status--info" },
  indexed: { label: "READY", className: "sc-status--success" },
  indexing: { label: "Indexing…", className: "sc-status--warning" },
  "not-indexed": { label: "Not indexed", className: "sc-status--muted" },
  error: { label: "Error", className: "sc-status--error" },
};

export function StatusBadge({ kind, label }: { kind: StatusKind; label?: string }) {
  const cfg = CONFIG[kind];
  return (
    <span className={`sc-status ${cfg.className}`}>
      <span className="sc-status__dot" />
      {label ?? cfg.label}
    </span>
  );
}

export function InlineCheck({ done }: { done: boolean }) {
  return done ? (
    <span className="sc-check sc-check--done">
      <Icon name="check" size={12} />
    </span>
  ) : (
    <span className="sc-check" />
  );
}
