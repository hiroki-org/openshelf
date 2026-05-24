import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, buildLoginUrl, useAuth } from "../auth-provider";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

function Consumer() {
  const { user, loading, logout, login, refresh } = useAuth();

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
      <button onClick={() => void refresh()} type="button">
        refresh
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

  describe("buildLoginUrl", () => {
    it("includes the current frontend origin when provided", () => {
      expect(
        buildLoginUrl(
          "https://api.example.com",
          "https://frontend.example.com",
        ),
      ).toBe(
        "https://api.example.com/api/auth/github?frontend_origin=https%3A%2F%2Ffrontend.example.com",
      );
    });

    it("omits the origin parameter when currentOrigin is empty", () => {
      expect(buildLoginUrl("https://api.example.com", "")).toBe(
        "https://api.example.com/api/auth/github",
      );
    });
  });

  it("keeps user null when /api/auth/me responds with non-ok", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 401 }));

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

  it("keeps user null when /api/auth/me throws", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch).mockRejectedValue(new Error("network error"));

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

  it("login logs an error and does not navigate when NEXT_PUBLIC_API_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const originalLocation = window.location;

    try {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, href: "https://app.example.com/current" },
      });

      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "login" }));

      expect(errorSpy).toHaveBeenCalled();
      expect(window.location.href).toBe("https://app.example.com/current");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("login navigates to the correct URL when NEXT_PUBLIC_API_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    const originalLocation = window.location;

    try {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: {
          ...originalLocation,
          origin: "https://app.example.com",
          href: "https://app.example.com/current",
        },
      });

      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "login" }));

      expect(window.location.href).toBe(
        "https://api.example.com/api/auth/github?frontend_origin=https%3A%2F%2Fapp.example.com",
      );
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("refresh re-fetches user data", async () => {
    localStorage.setItem("auth_token", "token-1");
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null }), { status: 401 }),
      )
      .mockResolvedValueOnce(
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
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
    });

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("Alice");
    });
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    function OutsideConsumer() {
      useAuth();
      return <div>outside</div>;
    }

    expect(() => render(<OutsideConsumer />)).toThrow(
      "useAuth must be used within AuthProvider",
    );
  });
});
