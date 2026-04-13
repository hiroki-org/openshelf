import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserCollectionPageClient from "../user-collection-page-client";
import { apiFetch } from "@/lib/api";

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

describe("UserCollectionPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders FeedButton on user collection pages", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/user-1/collections") {
        return new Response(
          JSON.stringify({
            collections: [
              {
                id: "col-1",
                slug: "featured",
                name: "Featured",
                description: "Featured papers",
                visibility: "public",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url === "/api/collections/col-1/papers") {
        return new Response(JSON.stringify({ papers: [] }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<UserCollectionPageClient id="user-1" collectionSlug="featured" />);

    await waitFor(() => {
      expect(screen.getByText("Featured")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "📡 Feed" })).toBeInTheDocument();
  });
});
