export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`${className} motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent`}
      aria-hidden="true"
    />
  );
}
