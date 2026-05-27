import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "../spinner";

describe("Spinner", () => {
  it("renders with default classes when no className is provided", () => {
    const { container } = render(<Spinner />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass("h-4", "w-4", "motion-safe:animate-spin");
  });

  it("does not render default size classes when w- or h- are provided in className", () => {
    const { container } = render(<Spinner className="h-6 w-6 text-blue-500" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).not.toHaveClass("h-4", "w-4");
    expect(spinner).toHaveClass("h-6", "w-6", "text-blue-500", "motion-safe:animate-spin");
  });

  it("renders default size classes when w- or h- are not provided in className", () => {
    const { container } = render(<Spinner className="text-blue-500" />);
    const spinner = container.firstChild as HTMLElement;
    expect(spinner).toHaveClass("h-4", "w-4", "text-blue-500", "motion-safe:animate-spin");
  });
});
