import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrgPageClient from "../orgs/[slug]/org-page-client";
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

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

describe("OrgPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1" } };
  });

  it("renders org details for admins", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: "Lab description",
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 2,
          }),
          { status: 200 },
        );
      }

      if (url === "/api/orgs/lab/papers") {
        return new Response(
          JSON.stringify({
            papers: [
              {
                id: "paper-1",
                title: "Paper One",
                abstract: "Summary",
                visibility: "public",
                venue: "Conf",
                venueType: "conference",
                year: 2025,
                category: "report",
                tags: null,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/orgs/lab/members") {
        return new Response(
          JSON.stringify({
            members: [
              {
                userId: "user-1",
                role: "admin",
                name: "Alice",
                displayName: null,
                avatarUrl: null,
                githubId: "alice",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/orgs/lab/collections") {
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

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);

    await waitFor(() => {
      expect(screen.getByText("Research Lab")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "⚙ 設定" })).toHaveAttribute(
      "href",
      "/orgs/lab/settings",
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Paper One")).toBeInTheDocument();
  });

  it("shows a not found error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 404 }));

    render(<OrgPageClient slug="missing" />);

    expect(await screen.findByText("組織が見つかりません")).toBeInTheDocument();
  });
});
