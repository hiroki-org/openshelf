import React from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
