import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaperEditPage from "../page";
import { apiFetch } from "@/lib/api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({
    id: "paper-1",
  }),
}));

// Mock auth-provider
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    loading: false,
  }),
}));

// Mock apiFetch
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

describe("PaperEditPage error handling", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("should display the error message when fetching paper throws an Error instance", async () => {
    // Mock apiFetch to throw an Error instance
    const errorMessage = "Network fetch failed";
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error(errorMessage));

    render(<PaperEditPage />);

    // Wait for the loading state to finish and the error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it("should display a fallback error message when fetching paper throws a non-Error", async () => {
    // Mock apiFetch to throw a non-Error (e.g. string)
    vi.mocked(apiFetch).mockRejectedValueOnce("Unexpected string error");

    render(<PaperEditPage />);

    // Wait for the loading state to finish and the fallback error message to appear
    await waitFor(() => {
      expect(screen.getByText("予期せぬエラーが発生しました")).toBeInTheDocument();
    });
  });
});
