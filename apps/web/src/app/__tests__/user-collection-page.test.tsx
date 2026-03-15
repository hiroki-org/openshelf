import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserCollectionPage from "../users/[id]/c/[collectionSlug]/page";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "user-1", collectionSlug: "favorites" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("UserCollectionPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a user collection and its papers", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({
            collections: [
              {
                id: "col-1",
                slug: "favorites",
                name: "Favorites",
                description: "Picked papers",
                visibility: "public",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/collections/col-1/papers") {
        return new Response(
          JSON.stringify({
            papers: [
              {
                id: "paper-1",
                title: "Paper One",
                abstract: "Summary",
                visibility: "public",
                sortOrder: 0,
              },
            ],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<UserCollectionPage />);

    await waitFor(() => {
      expect(screen.getByText("Favorites")).toBeInTheDocument();
    });

    expect(screen.getByText("Picked papers")).toBeInTheDocument();
    expect(screen.getByText("Paper One")).toBeInTheDocument();
  });

  it("shows a not-found error when the collection is missing", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ collections: [] }), { status: 200 }),
    );

    render(<UserCollectionPage />);

    expect(await screen.findByText("コレクションが見つかりません")).toBeInTheDocument();
  });
});
