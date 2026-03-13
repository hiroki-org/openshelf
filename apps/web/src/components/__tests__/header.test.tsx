import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { Header } from "../header";
import { useAuth } from "../auth-provider";
import { usePathname } from "next/navigation";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("../auth-provider", () => ({
  useAuth: vi.fn(),
}));

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRefresh = vi.fn();

describe("Header", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the logo", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      refresh: mockRefresh,
    });

    render(<Header />);
    expect(screen.getByText("OpenShelf")).toBeInTheDocument();
  });

  it("renders login button when unauthenticated", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      refresh: mockRefresh,
    });

    render(<Header />);
    const loginButton = screen.getByRole("button", { name: "GitHubでログイン" });
    expect(loginButton).toBeInTheDocument();

    fireEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalled();
  });

  it("renders user info and navigation when authenticated", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "1",
        githubId: 12345,
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        email: "test@example.com",
      },
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      refresh: mockRefresh,
    });

    render(<Header />);

    // Renders navigation items
    expect(screen.getByText("アップロード")).toBeInTheDocument();
    expect(screen.getByText("コレクション")).toBeInTheDocument();
    expect(screen.getByText("招待")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();

    // Renders user info
    expect(screen.getByText("Test User")).toBeInTheDocument();
    const avatar = screen.getByAltText("Test User");
    expect(avatar).toBeInTheDocument();

    // Renders logout button
    const logoutButton = screen.getByRole("button", { name: "ログアウト" });
    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalled();
  });

  it("applies active state to navigation items correctly", () => {
    vi.mocked(usePathname).mockReturnValue("/upload");
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "1",
        githubId: 12345,
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        email: "test@example.com",
      },
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      refresh: mockRefresh,
    });

    render(<Header />);

    const uploadLink = screen.getByRole("link", { name: "アップロード" });
    expect(uploadLink).toHaveAttribute("aria-current", "page");

    const settingsLink = screen.getByRole("link", { name: "設定" });
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("renders nothing for user section while loading", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      login: mockLogin,
      logout: mockLogout,
      refresh: mockRefresh,
    });

    render(<Header />);

    expect(screen.queryByRole("button", { name: "GitHubでログイン" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
    expect(screen.queryByText("アップロード")).not.toBeInTheDocument();
  });
});
