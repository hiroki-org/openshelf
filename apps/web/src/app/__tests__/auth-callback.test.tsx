import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "../auth/callback/page";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("AuthCallback", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    replace.mockReset();
  });

  it("redirects to home", async () => {
    render(<AuthCallback />);

    expect(screen.getByText("ログイン中...")).toBeInTheDocument();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });
});
