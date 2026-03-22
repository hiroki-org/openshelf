import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrgPageClient from "../org-page-client";
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
  default: ({ alt = "image", ...props }: any) => <img alt={alt} {...props} />,
}));

describe("OrgPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1" } };
  });

  afterEach(() => {
    cleanup();
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
                displayName: "Alice Admin",
                avatarUrl: "https://example.com/alice.png",
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

    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "⚙ 設定" })).toHaveAttribute(
      "href",
      "/orgs/lab/settings",
    );
    expect(await screen.findByAltText("Alice")).toHaveAttribute(
      "src",
      "https://example.com/alice.png",
    );
    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(await screen.findByText("Featured")).toBeInTheDocument();
    expect(await screen.findByText("Paper One")).toBeInTheDocument();
  });

  it("shows a not found error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 404 }));

    render(<OrgPageClient slug="missing" />);

    expect(await screen.findByText("組織が見つかりません")).toBeInTheDocument();
  });

  it("handles generic fetch errors and network failures", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));
    render(<OrgPageClient slug="fail" />);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();

    cleanup();
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network Error"));
    render(<OrgPageClient slug="netfail" />);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("renders correctly for non-admin users and empty states", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(JSON.stringify({ org: { name: "L", slug: "lab", description: null }, memberCount: 1 }), { status: 200 });
      }
      if (url === "/api/orgs/lab/papers") return new Response(JSON.stringify({ papers: [] }), { status: 200 });
      if (url === "/api/orgs/lab/members") return new Response(JSON.stringify({ members: [{ userId: "u2", role: "member", name: "B", displayName: null, avatarUrl: null }] }), { status: 200 });
      if (url === "/api/orgs/lab/collections") return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      throw new Error("Unexpected");
    });

    render(<OrgPageClient slug="lab" />);

    expect(await screen.findByText("L")).toBeInTheDocument();
    expect(screen.queryByText("⚙ 設定")).not.toBeInTheDocument();
    expect(screen.getByText("コレクションがありません")).toBeInTheDocument();
    expect(screen.getByText("まだ論文がありません")).toBeInTheDocument();
  });

  it("handles sub-request partial failures", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(JSON.stringify({ org: { name: "L", slug: "lab", description: null }, memberCount: 1 }), { status: 200 });
      }
      return new Response(null, { status: 500 });
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("L")).toBeInTheDocument();
    // collections and papers should stay empty and show empty state messages
    expect(await screen.findByText("コレクションがありません")).toBeInTheDocument();
    expect(await screen.findByText("まだ論文がありません")).toBeInTheDocument();
  });
});
