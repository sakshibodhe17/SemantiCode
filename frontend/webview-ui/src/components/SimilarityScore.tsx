export function SimilarityScore({ value }: { value: number }) {
  const tier = value >= 90 ? "high" : value >= 75 ? "mid" : "low";
  return (
    <div className={`sc-similarity sc-similarity--${tier}`} title="Cosine similarity (mock)">
      <div className="sc-similarity__bar">
        <div className="sc-similarity__fill" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="sc-similarity__value">{value.toFixed(2)}%</span>
    </div>
  );
}
