import React from "react";

type SpinnerProps = {
  className?: string;
  sizeClassName?: string;
  borderClassName?: string;
};

export function Spinner({
  className = "",
  sizeClassName = "h-4 w-4",
  borderClassName = "border-2",
}: SpinnerProps) {
  return (
    <span
      className={`${sizeClassName} motion-safe:animate-spin rounded-full ${borderClassName} border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}
