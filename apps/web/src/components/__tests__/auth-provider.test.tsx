import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from "vitest";
import { AuthProvider, useAuth } from "../auth-provider";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

function Consumer() {
  const { user, loading, logout, login } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button onClick={() => void logout()} type="button">
        logout
      </button>
      <button onClick={() => login()} type="button">
        login
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Mock window.location for login tests
    // @ts-ignore
    delete window.location;
    window.location = { ...originalLocation, href: "" };
  });

  afterEach(() => {
    cleanup();
    window.location = originalLocation;
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

  it("sets user to null when apiFetch returns non-ok response", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));

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

  it("sets user to null when apiFetch throws an error", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network error"));

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

  it("redirects to github auth on login", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    // Default case where NEXT_PUBLIC_API_URL is undefined
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8787";

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(window.location.href).toBe("http://localhost:8787/api/auth/github");

    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  it("redirects to github auth on login without NEXT_PUBLIC_API_URL", async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    // Default case where NEXT_PUBLIC_API_URL is undefined
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(window.location.href).toBe("/api/auth/github");

    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  it("useAuth throws an error when used outside AuthProvider", () => {
    function OutsideConsumer() {
      useAuth();
      return null;
    }

    // Suppress React error boundaries logging to console.error
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => render(<OutsideConsumer />)).toThrow(
      "useAuth must be used within AuthProvider"
    );

    console.error = originalError;
  });
});
