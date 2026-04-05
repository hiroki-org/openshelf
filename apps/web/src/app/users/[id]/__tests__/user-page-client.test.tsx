import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserPageClient from "../user-page-client";
import { apiFetch } from "@/lib/api";

let authState: { user: { id: string } | null };

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/feed-button", () => ({
  FeedButton: ({ url }: { url: string }) => (
    <button type="button" data-testid="feed-button" data-url={url}>
      Feed
    </button>
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("UserPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1" } };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders profile from initialUser without fetching profile from API", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({ collections: [] }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Alice A.")).toBeInTheDocument();
    });
    expect(screen.getByText("@alice")).toBeInTheDocument();
    // Profile endpoint should not have been called
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/users/user-1"),
    );
  });

  it("falls back to name when displayName is null", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "AliceLogin",
          displayName: null,
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("AliceLogin")).toBeInTheDocument();
    });
  });

  it("fetches profile from API when initialUser is not provided", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-2") {
        return new Response(
          JSON.stringify({
            user: {
              id: "user-2",
              name: "Bob",
              displayName: "Bob B.",
              avatarUrl: null,
              githubId: "bob",
            },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/users/user-2/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(<UserPageClient id="user-2" />);

    await waitFor(() => {
      expect(screen.getByText("Bob B.")).toBeInTheDocument();
    });
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });

  it("shows 404 error message when profile fetch returns 404", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-3") {
        return new Response("{}", { status: 404 });
      }
      if (url === "/api/users/user-3/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(<UserPageClient id="user-3" />);

    expect(
      await screen.findByText("ユーザーが見つかりません"),
    ).toBeInTheDocument();
  });

  it("shows generic error message when profile fetch returns non-404 error", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-3") {
        return new Response("{}", { status: 500 });
      }
      if (url === "/api/users/user-3/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(<UserPageClient id="user-3" />);

    expect(
      await screen.findByText("ユーザー情報の取得に失敗しました"),
    ).toBeInTheDocument();
  });

  it("shows generic error when apiFetch throws", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network error"));

    render(<UserPageClient id="user-3" />);

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("renders collections list when collections are present", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({
            collections: [
              {
                id: "col-1",
                slug: "favorites",
                name: "Favorites",
                description: "Pinned papers",
                visibility: "public",
              },
              {
                id: "col-2",
                slug: "private-list",
                name: "Private List",
                description: null,
                visibility: "private",
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Favorites")).toBeInTheDocument();
    });

    expect(screen.getByText("Pinned papers")).toBeInTheDocument();
    expect(screen.getByText("Private List")).toBeInTheDocument();
    expect(screen.getByText("public")).toBeInTheDocument();
    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("shows empty collections message when there are no collections", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("コレクションがありません")).toBeInTheDocument();
    });
  });

  it("shows new collection link when viewing own profile", async () => {
    authState = { user: { id: "user-1" } };

    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "+ 新規作成" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "+ 新規作成" })).toHaveAttribute(
      "href",
      "/collections/new",
    );
  });

  it("hides new collection link when viewing another user's profile", async () => {
    authState = { user: { id: "other-user" } };

    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("コレクションがありません")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: "+ 新規作成" }),
    ).not.toBeInTheDocument();
  });

  it("renders FeedButton with correct feed URL", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: "Alice A.",
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("feed-button")).toBeInTheDocument();
    });

    const feedBtn = screen.getByTestId("feed-button");
    expect(feedBtn.getAttribute("data-url")).toContain(
      "/feed/users/user-1/atom.xml",
    );
  });

  it("collection links point to correct URLs", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({
            collections: [
              {
                id: "col-1",
                slug: "my-list",
                name: "My List",
                description: null,
                visibility: "public",
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${String(url)}`);
    });

    render(
      <UserPageClient
        id="user-1"
        initialUser={{
          id: "user-1",
          name: "Alice",
          displayName: null,
          avatarUrl: null,
          githubId: "alice",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("My List")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /My List/ })).toHaveAttribute(
      "href",
      "/users/user-1/c/my-list",
    );
  });
});