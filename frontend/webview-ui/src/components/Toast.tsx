export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="sc-toast" role="status">
      {message}
    </div>
  );
}
