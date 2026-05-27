import React from "react";

export function Spinner({ className = "" }: { className?: string }) {
  const hasSize = /\b(w-|h-)\d+\b/.test(className);
  return (
    <span
      className={`${hasSize ? "" : "h-4 w-4 "}motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
