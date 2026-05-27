import React from "react";

export function Spinner({ className = "" }: { className?: string }) {
  const hasWidth = className.split(" ").some((cls) => cls.startsWith("w-"));
  const hasHeight = className.split(" ").some((cls) => cls.startsWith("h-"));

  const sizeClasses = `${hasWidth ? "" : "w-4"} ${hasHeight ? "" : "h-4"}`;

  return (
    <span
      className={`${sizeClasses} motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

