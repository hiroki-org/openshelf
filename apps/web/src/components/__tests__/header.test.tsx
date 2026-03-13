import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Header } from "../header";
import { useAuth } from "../auth-provider";
import { usePathname } from "next/navigation";

// Mock dependencies
vi.mock("../auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("Header", () => {
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state correctly", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: true,
      login: mockLogin,
      logout: mockLogout,
    });
    vi.mocked(usePathname).mockReturnValue("/");

    render(<Header />);

    // Should not display login button or user info
    expect(screen.queryByText("GitHubでログイン")).not.toBeInTheDocument();
    expect(screen.queryByText("ログアウト")).not.toBeInTheDocument();
    expect(screen.getByText("OpenShelf")).toBeInTheDocument();
  });

  it("renders unauthenticated state correctly", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
    });
    vi.mocked(usePathname).mockReturnValue("/");

    render(<Header />);

    // Should display login button
    const loginButton = screen.getByText("GitHubでログイン");
    expect(loginButton).toBeInTheDocument();

    // Should not display nav links or logout
    expect(screen.queryByText("アップロード")).not.toBeInTheDocument();
    expect(screen.queryByText("ログアウト")).not.toBeInTheDocument();

    // Clicking login calls the mock function
    fireEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("renders authenticated state correctly", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "u1",
        githubId: 123,
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        email: "test@example.com"
      },
      loading: false,
      login: mockLogin,
      logout: mockLogout,
    });
    vi.mocked(usePathname).mockReturnValue("/");

    render(<Header />);

    // Should display nav links
    expect(screen.getByText("アップロード")).toBeInTheDocument();
    expect(screen.getByText("コレクション")).toBeInTheDocument();
    expect(screen.getByText("招待")).toBeInTheDocument();
    expect(screen.getByText("設定")).toBeInTheDocument();

    // Should display user name
    expect(screen.getByText("Test User")).toBeInTheDocument();

    // Should display logout button
    const logoutButton = screen.getByText("ログアウト");
    expect(logoutButton).toBeInTheDocument();

    // Clicking logout calls the mock function
    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("highlights the active navigation link correctly", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "u1",
        githubId: 123,
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        email: "test@example.com"
      },
      loading: false,
      login: mockLogin,
      logout: mockLogout,
    });
    // Set pathname to a sub-route of collection
    vi.mocked(usePathname).mockReturnValue("/collections/new");

    render(<Header />);

    const collectionLink = screen.getByText("コレクション");
    expect(collectionLink).toHaveAttribute("aria-current", "page");

    const uploadLink = screen.getByText("アップロード");
    expect(uploadLink).not.toHaveAttribute("aria-current");
  });

  it("highlights correctly when route starts with the nav link href", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "u1",
        githubId: 123,
        name: "testuser",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        email: "test@example.com"
      },
      loading: false,
      login: mockLogin,
      logout: mockLogout,
    });
    // The active path check is: pathname === item.href || pathname.startsWith(`${item.href}/`);
    vi.mocked(usePathname).mockReturnValue("/settings/profile");

    render(<Header />);

    const settingsLink = screen.getByText("設定");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
  });
});
