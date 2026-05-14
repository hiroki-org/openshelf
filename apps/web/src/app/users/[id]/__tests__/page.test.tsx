import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserPage from "../page";
import { apiFetch } from "@/lib/api";

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

describe("UserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1" } };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the user profile and collections", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            name: "Alice",
            displayName: "Alice A.",
            avatarUrl: null,
            githubId: "alice",
          },
        }),
        { status: 200 },
      ) as Response,
    );

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
            ],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    const view = await UserPage({ params: { id: "user-1" } });
    render(view);

    await waitFor(() => {
      expect(screen.getByText("Alice A.")).toBeInTheDocument();
    });

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(await screen.findByText("Favorites")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ 新規作成" })).toHaveAttribute(
      "href",
      "/collections/new",
    );
  });

  it("shows an error when the profile cannot be loaded", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1") {
        return new Response("{}", { status: 404 });
      }

      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: null }), { status: 404 }) as Response,
    );

    const view = await UserPage({ params: { id: "user-1" } });
    render(view);

    expect(
      await screen.findByText("ユーザーが見つかりません"),
    ).toBeInTheDocument();
  });

  it("shows generic profile error for non-404 profile responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: null }), { status: 500 }) as Response,
    );

    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1") {
        return new Response("{}", { status: 500 });
      }

      if (url === "/api/users/user-1/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    const view = await UserPage({ params: { id: "user-1" } });
    render(view);

    expect(
      await screen.findByText("ユーザー情報の取得に失敗しました"),
    ).toBeInTheDocument();
  });
});
