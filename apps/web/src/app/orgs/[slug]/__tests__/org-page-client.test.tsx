import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrgPageClient from "../org-page-client";
import { apiFetch } from "@/lib/api";

let authState: any;
const replaceMock = vi.fn();
let params = new URLSearchParams();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/orgs/lab",
  useSearchParams: () => params,
}));

describe("OrgPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1" } };
    params = new URLSearchParams();
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

      if (url === "/api/orgs/lab/papers?paginate=1&autoYear=1&page=1") {
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
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            appliedFilters: { year: null, venue: null, category: null },
            filterOptions: {
              years: [{ value: 2025, count: 1 }],
              venues: [{ value: "Conf", count: 1 }],
              categories: [{ value: "report", count: 1 }],
            },
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

    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "⚙ 設定" })).toHaveAttribute(
      "href",
      "/orgs/lab/settings",
    );
    expect(await screen.findByText("Featured")).toBeInTheDocument();
    expect(await screen.findByText("Paper One")).toBeInTheDocument();
  });

  it("updates query params when filter changes", async () => {
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
            memberCount: 1,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/papers?paginate=1&autoYear=1&page=1") {
        return new Response(
          JSON.stringify({
            papers: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            appliedFilters: { year: null, venue: null, category: null },
            filterOptions: {
              years: [{ value: 2025, count: 2 }],
              venues: [{ value: "ASE", count: 1 }],
              categories: [{ value: "report", count: 1 }],
            },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/members") {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/collections") {
        return new Response(JSON.stringify({ collections: [] }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("年度"), { target: { value: "2025" } });
    expect(replaceMock).toHaveBeenCalledWith("/orgs/lab?year=2025");
  });

  it("shows a not found error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 404 }));

    render(<OrgPageClient slug="missing" />);

    expect(await screen.findByText("組織が見つかりません")).toBeInTheDocument();
  });
});
