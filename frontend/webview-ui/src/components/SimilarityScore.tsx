export function SimilarityScore({ value }: { value: number }) {
  const tier = value >= 85 ? "high" : value >= 65 ? "mid" : "low";
  return (
    <div
      className={`sc-similarity sc-similarity--${tier}`}
      title="Relevance: share of your query's concepts this code covers, blended with its BM25F score relative to the best match"
    >
      <div className="sc-similarity__bar">
        <div className="sc-similarity__fill" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="sc-similarity__value">{value.toFixed(1)}%</span>
    </div>
  );
}
