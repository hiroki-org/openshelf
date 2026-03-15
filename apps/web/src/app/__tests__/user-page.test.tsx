import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserPage from "../users/[id]/page";
import { apiFetch } from "@/lib/api";

let authState: any;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "user-1" }),
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

  it("renders the user profile and collections", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1") {
        return new Response(
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
        );
      }

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

    render(<UserPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice A.")).toBeInTheDocument();
    });

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
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

      return new Response(JSON.stringify({ collections: [] }), { status: 200 });
    });

    render(<UserPage />);

    expect(await screen.findByText("ユーザーが見つかりません")).toBeInTheDocument();
  });
});
