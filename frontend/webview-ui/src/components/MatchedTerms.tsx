import type { MatchedTerm } from "../data/types";

const VIA_LABEL: Record<MatchedTerm["via"], string> = {
  exact: "exact word match",
  prefix: "partial word match",
  concept: "related concept",
};

/** "Why did this match?" chips — makes the ranking explainable. */
export function MatchedTerms({ terms }: { terms: MatchedTerm[] }) {
  if (!terms.length) return null;
  return (
    <span className="sc-matched">
      {terms.map((t) => (
        <span key={t.term + t.via} className={`sc-chip sc-chip--${t.via}`} title={VIA_LABEL[t.via]}>
          {t.via === "concept" ? "≈ " : ""}
          {t.term}
        </span>
      ))}
    </span>
  );
}
