import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "../auth-provider";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

function TestComponent() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.name : "null"}</div>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset window.location
    delete (window as any).location;
    window.location = { href: "" } as any;
  });

  afterEach(() => {
    cleanup();
  });

  it("loads user if token exists", async () => {
    localStorage.setItem("auth_token", "test-token");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "1", name: "Test User", githubId: 123, avatarUrl: "", email: null, displayName: null } }),
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByTestId("user").textContent).toBe("Test User");
  });

  it("logout clears localStorage token and sets user null", async () => {
    localStorage.setItem("auth_token", "test-token");
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: "1", name: "Test User", githubId: 123, avatarUrl: "", email: null, displayName: null } }),
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("login with NEXT_PUBLIC_API_URL set redirects", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.example.com");

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    await act(async () => {
      screen.getByText("Login").click();
    });

    expect(window.location.href).toBe("http://api.example.com/api/auth/github");
    vi.unstubAllEnvs();
  });

  it("login without NEXT_PUBLIC_API_URL does nothing (no-op)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    await act(async () => {
      screen.getByText("Login").click();
    });

    expect(window.location.href).toBe("");
    vi.unstubAllEnvs();
  });
});
