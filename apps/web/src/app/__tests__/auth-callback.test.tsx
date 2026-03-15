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
    localStorage.clear();
    window.location.hash = "";
  });

  it("stores the token from the hash fragment", async () => {
    window.location.hash = "#token=test-token";

    render(<AuthCallback />);

    expect(screen.getByText("ログイン中...")).toBeInTheDocument();

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBe("test-token");
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("redirects even when no token is present", async () => {
    render(<AuthCallback />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });
});
