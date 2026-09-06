import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sc-empty">
      <div className="sc-empty__icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="sc-empty__title">{title}</div>
      {description && <div className="sc-empty__desc">{description}</div>}
      {action && <div className="sc-empty__action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="sc-loading" role="status" aria-live="polite">
      <span className="sc-spinner" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="sc-empty sc-empty--error" role="alert">
      <div className="sc-empty__icon sc-empty__icon--error">
        <Icon name="close" size={20} />
      </div>
      <div className="sc-empty__title">{title}</div>
      {description && <div className="sc-empty__desc">{description}</div>}
      {onRetry && (
        <button className="sc-btn sc-btn--secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
