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

function LoginConsumer() {
  const { login } = useAuth();

  return (
    <button onClick={login} type="button">
      login
    </button>
  );
}

describe("AuthProvider login", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
    });
  });

  afterEach(() => {
    cleanup();

    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does nothing when NEXT_PUBLIC_API_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(window.location.href).toBe("http://localhost/");
  });

  it("redirects to OAuth endpoint when NEXT_PUBLIC_API_URL is set", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";

    render(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(window.location.href).toBe("https://api.example.com/api/auth/github");
  });
});
