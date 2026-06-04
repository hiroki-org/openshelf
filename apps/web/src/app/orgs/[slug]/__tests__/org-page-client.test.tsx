import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    cleanup();
  });

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
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();

    const [yearSelect] = screen.getAllByRole("combobox");
    fireEvent.change(yearSelect, { target: { value: "2025" } });
    expect(replaceMock).toHaveBeenCalledWith("/orgs/lab?year=2025");
  });

  it("shows a not found error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 404 }));

    render(<OrgPageClient slug="missing" />);

    expect(await screen.findByText("組織が見つかりません")).toBeInTheDocument();
  });

  it("supports pagination controls and clearing filters", async () => {
    params = new URLSearchParams("venue=ASE&category=report&page=2");
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 1,
            paperCount: 3,
          }),
          { status: 200 },
        );
      }
      if (
        url ===
        "/api/orgs/lab/papers?paginate=1&autoYear=1&venue=ASE&category=report&page=2"
      ) {
        return new Response(
          JSON.stringify({
            papers: [
              {
                id: "paper-2",
                title: "Paper Two",
                abstract: null,
                visibility: "public",
                venue: "ASE",
                venueType: "conference",
                year: 2025,
                category: "report",
                tags: null,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ],
            total: 3,
            page: 2,
            pageSize: 1,
            totalPages: 3,
            appliedFilters: { year: null, venue: "ASE", category: "report" },
            filterOptions: {
              years: [],
              venues: [{ value: "ASE", count: 3 }],
              categories: [{ value: "report", count: 3 }],
            },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/members") {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Paper Two")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    const nextCall =
      replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0];
    expect(nextCall).toContain("/orgs/lab?");
    expect(nextCall).toContain("page=3");
    expect(nextCall).toContain("venue=ASE");
    expect(nextCall).toContain("category=report");

    fireEvent.click(screen.getByRole("button", { name: "前へ" }));
    const prevCall =
      replaceMock.mock.calls[replaceMock.mock.calls.length - 1][0];
    expect(prevCall).toContain("/orgs/lab?");
    expect(prevCall).toContain("page=1");
    expect(prevCall).toContain("venue=ASE");
    expect(prevCall).toContain("category=report");

    fireEvent.click(screen.getByRole("button", { name: "フィルタをクリア" }));
    expect(replaceMock).toHaveBeenCalledWith("/orgs/lab");
  });

  it("hides admin links for non-admin members", async () => {
    authState = { user: { id: "user-2" } };
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
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
            filterOptions: { years: [], venues: [], categories: [] },
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
                role: "member",
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
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "⚙ 設定" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+ 成果物を追加" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "+ 新規作成" }),
    ).not.toBeInTheDocument();
  });

  it("renders empty papers when papers endpoint responds with non-ok", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 1,
            paperCount: 0,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/papers?paginate=1&autoYear=1&page=1") {
        return new Response("{}", { status: 500 });
      }
      if (url === "/api/orgs/lab/members") {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    expect(
      await screen.findByText("まだ成果物がありません"),
    ).toBeInTheDocument();
  });

  it("applies explicit all-year filter when selecting empty year option", async () => {
    params = new URLSearchParams("year=2025");
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 1,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/papers?paginate=1&year=2025&page=1") {
        return new Response(
          JSON.stringify({
            papers: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            appliedFilters: { year: 2025, venue: null, category: null },
            filterOptions: {
              years: [{ value: 2025, count: 2 }],
              venues: [],
              categories: [],
            },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/members") {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();

    const [yearSelect] = screen.getAllByRole("combobox");
    fireEvent.change(yearSelect, { target: { value: "" } });
    expect(replaceMock).toHaveBeenCalledWith("/orgs/lab?year=all");
  });

  it("updates venue and category filters while preserving selected values", async () => {
    params = new URLSearchParams("year=2025&page=3");
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 1,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/papers?paginate=1&year=2025&page=3") {
        return new Response(
          JSON.stringify({
            papers: [],
            total: 0,
            page: 3,
            pageSize: 20,
            totalPages: 3,
            appliedFilters: { year: 2025, venue: null, category: null },
            filterOptions: {
              years: [{ value: 2025, count: 3 }],
              venues: [{ value: "ASE", count: 2 }],
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
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    const [, venueSelect, categorySelect] = screen.getAllByRole("combobox");

    fireEvent.change(venueSelect, { target: { value: "ASE" } });
    expect(replaceMock).toHaveBeenCalledWith("/orgs/lab?year=2025&venue=ASE");

    fireEvent.change(categorySelect, { target: { value: "report" } });
    expect(replaceMock).toHaveBeenCalledWith(
      "/orgs/lab?year=2025&category=report",
    );
  });

  it("shows generic error when organization metadata request fails", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("network error"));

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("keeps empty list when papers response shape is non-paginated", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/orgs/lab") {
        return new Response(
          JSON.stringify({
            org: {
              id: "org-1",
              slug: "lab",
              name: "Research Lab",
              description: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
            memberCount: 1,
            paperCount: 0,
          }),
          { status: 200 },
        );
      }
      if (url === "/api/orgs/lab/papers?paginate=1&autoYear=1&page=1") {
        return new Response(JSON.stringify({ papers: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/members") {
        return new Response(JSON.stringify({ members: [] }), { status: 200 });
      }
      if (url === "/api/orgs/lab/collections") {
        return new Response(JSON.stringify({ collections: [] }), {
          status: 200,
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<OrgPageClient slug="lab" />);
    expect(await screen.findByText("Research Lab")).toBeInTheDocument();
    expect(
      await screen.findByText("まだ成果物がありません"),
    ).toBeInTheDocument();
  });
});
