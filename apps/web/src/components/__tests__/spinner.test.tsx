import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "../spinner";

describe("Spinner", () => {
  it("renders with default classes", () => {
    const { container } = render(<Spinner />);
    const spinner = container.firstElementChild;

    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass(
      "h-4",
      "w-4",
      "motion-safe:animate-spin",
      "rounded-full",
      "border-2",
      "border-current",
      "border-t-transparent",
    );
  });

  it("applies custom className", () => {
    const { container } = render(
      <Spinner className="text-red-500 custom-class" />,
    );
    const spinner = container.firstElementChild;

    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass(
      "h-4",
      "w-4",
      "motion-safe:animate-spin",
      "rounded-full",
      "border-2",
      "border-current",
      "border-t-transparent",
    );
    expect(spinner).toHaveClass("text-red-500", "custom-class");
  });

  it("has aria-hidden attribute set to true", () => {
    const { container } = render(<Spinner />);
    const spinner = container.firstElementChild;

    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });
});
