import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../page";
import { apiFetch } from "@/lib/api";

const login = vi.fn();
let authState: any;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Home page", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: null, loading: false, login };
    login.mockReset();
  });

  it("shows the marketing view for guests", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "GitHubでログイン" }));

    expect(
      screen.getByRole("heading", {
        name: /研究成果物を保存し、共有する。/,
      }),
    ).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("shows an empty dashboard for authenticated users without papers", async () => {
    authState = {
      user: { id: "user-1", name: "Alice" },
      loading: false,
      login,
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ papers: [] }), { status: 200 }),
    );

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("まだ論文がありません")).toBeInTheDocument();
    });

    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(apiFetch).toHaveBeenCalledWith("/api/papers");
  });

  it("sorts papers by created date and shows stats", async () => {
    authState = {
      user: { id: "user-1", name: "Alice" },
      loading: false,
      login,
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          papers: [
            {
              id: "paper-older",
              title: "Older paper",
              visibility: "public",
              year: 2024,
              category: "report",
              createdAt: "2026-03-01 12:00:00",
            },
            {
              id: "paper-newer",
              title: "Newer paper",
              visibility: "private",
              year: 2025,
              category: "thesis_master",
              createdAt: "2026-03-02T09:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("最近の成果物")).toBeInTheDocument();
    });
    let paperLinks: HTMLElement[] = [];
    await waitFor(() => {
      paperLinks = screen.getAllByRole("link").filter((link) => {
        const href = link.getAttribute("href") ?? "";
        return href.startsWith("/papers/");
      });
      expect(paperLinks).toHaveLength(2);
    });

    expect(paperLinks[0]).toHaveTextContent("Newer paper");
    expect(paperLinks[1]).toHaveTextContent("Older paper");
    expect(screen.getAllByText("公開")).toHaveLength(1);
  });
});
