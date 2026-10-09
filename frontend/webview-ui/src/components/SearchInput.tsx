import { useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";

export function SearchInput({
  value,
  onChange,
  onSubmit,
  workspaceName,
  topK,
  onTopKChange,
  isSearching,
  focusToken = 0,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  workspaceName: string;
  topK: number;
  onTopKChange: (n: number) => void;
  isSearching: boolean;
  focusToken?: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);
  const trimmed = value.trim();
  const isInvalid = value.length > 0 && trimmed.length < 3;

  return (
    <form
      className="sc-search-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed.length >= 3) onSubmit();
      }}
    >
      <label className="sc-field-label" htmlFor={inputId}>
        Natural-language query
      </label>
      <div className={`sc-search-box ${isInvalid ? "is-invalid" : ""}`}>
        <Icon name="search" size={14} />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="e.g. Where is JWT authentication handled?"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={isInvalid}
          aria-describedby={`${inputId}-hint`}
        />
      </div>
      <div id={`${inputId}-hint`} className={`sc-field-hint ${isInvalid ? "sc-field-hint--error" : ""}`}>
        {isInvalid
          ? "Type at least 3 characters — try describing what the code does, not exact keywords."
          : "Describe behaviour in plain English — related concepts (login ↔ auth ↔ jwt) are matched too."}
      </div>

      <div className="sc-search-meta">
        <div className="sc-search-meta__item">
          <span className="sc-field-label">Workspace</span>
          <span className="sc-mono sc-search-meta__value">{workspaceName}</span>
        </div>
        <div className="sc-search-meta__item">
          <label className="sc-field-label" htmlFor={`${inputId}-topk`}>
            Results
          </label>
          <select
            id={`${inputId}-topk`}
            className="sc-select"
            value={topK}
            onChange={(e) => onTopKChange(Number(e.target.value))}
          >
            {[5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="sc-btn sc-btn--primary sc-search-submit"
        disabled={trimmed.length < 3 || isSearching}
      >
        {isSearching ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

export function SuggestedQueries({
  queries,
  onPick,
}: {
  queries: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="sc-suggested">
      <div className="sc-field-label">Suggested queries</div>
      <ul>
        {queries.map((q) => (
          <li key={q}>
            <button type="button" className="sc-suggested__item" onClick={() => onPick(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
