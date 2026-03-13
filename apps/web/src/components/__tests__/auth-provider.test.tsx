import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../auth-provider";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

function Consumer() {
  const { user, loading, logout } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button onClick={() => void logout()} type="button">
        logout
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("sets user when token exists and /api/auth/me succeeds", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "u1",
            githubId: 1,
            name: "Alice",
            displayName: null,
            avatarUrl: "",
            email: null,
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Alice");
    });
  });

  it("keeps user null when token does not exist", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  it("logout clears localStorage token and sets user null", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "u1",
            githubId: 1,
            name: "Alice",
            displayName: null,
            avatarUrl: "",
            email: null,
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Alice");
    });

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });
});
