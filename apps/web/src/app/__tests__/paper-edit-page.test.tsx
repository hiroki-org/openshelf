import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaperEditPage from "../papers/[id]/edit/page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let authState: any;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  useParams: () => ({ id: "paper-1" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("PaperEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    replace.mockReset();
    refresh.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
  });

  afterEach(() => {
    cleanup();
  });

  it("loads paper data and submits updates", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/me/orgs") {
        return new Response(
          JSON.stringify({
            organizations: [
              { id: "org-1", name: "Org 1", slug: "org-1", role: "member" },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Original title",
              abstract: "Original abstract",
              visibility: "private",
              showViewCount: false,
              language: "ja",
              externalUrl: null,
              doi: null,
              venue: "Conference",
              venueType: "conference",
              year: 2025,
              category: "report",
              tags: JSON.stringify(["AI"]),
            },
            authors: [{ userId: "user-1" }],
            organizations: [],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original title")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "Updated title" },
    });
    fireEvent.click(screen.getByLabelText(/公開ページに閲覧数を表示する/i));
    fireEvent.change(screen.getByLabelText(/タグ/i), {
      target: { value: "AI, LLM" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "保存する" })[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    expect(push).toHaveBeenCalledWith("/papers/paper-1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("redirects non-authors back to the paper page", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => {
      if (url === "/api/users/me/orgs") {
        return new Response(JSON.stringify({ organizations: [] }), {
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({
          paper: {
            title: "Original title",
            abstract: null,
            visibility: "private",
            showViewCount: false,
            language: null,
            externalUrl: null,
            doi: null,
            venue: null,
            venueType: null,
            year: null,
            category: null,
            tags: null,
          },
          authors: [{ userId: "user-2" }],
          organizations: [],
        }),
        { status: 200 },
      );
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/papers/paper-1");
    });
  });

  it("submits selected orgIds when changing visibility to org_only", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/me/orgs") {
        return new Response(
          JSON.stringify({
            organizations: [
              { id: "org-1", name: "Org 1", slug: "org-1", role: "member" },
              { id: "org-2", name: "Org 2", slug: "org-2", role: "admin" },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Original title",
              abstract: null,
              visibility: "private",
              showViewCount: false,
              language: null,
              externalUrl: null,
              doi: null,
              venue: null,
              venueType: null,
              year: null,
              category: null,
              tags: null,
            },
            authors: [{ userId: "user-1" }],
            organizations: [],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original title")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("組織内"));
    fireEvent.click(screen.getByLabelText(/Org 1/i));
    fireEvent.click(screen.getAllByRole("button", { name: "保存する" })[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = vi
      .mocked(apiFetch)
      .mock.calls.find(
        (call) =>
          call[0] === "/api/papers/paper-1" && call[1]?.method === "PATCH",
      );
    const payload = JSON.parse(String(patchCall?.[1]?.body));
    expect(payload.visibility).toBe("org_only");
    expect(payload.orgIds).toEqual(["org-1"]);
  });

  it("does not send orgIds when org_only selection is unchanged", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/me/orgs") {
        return new Response(
          JSON.stringify({
            organizations: [
              { id: "org-1", name: "Org 1", slug: "org-1", role: "member" },
            ],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Original title",
              abstract: null,
              visibility: "org_only",
              showViewCount: false,
              language: null,
              externalUrl: null,
              doi: null,
              venue: null,
              venueType: null,
              year: null,
              category: null,
              tags: null,
            },
            authors: [{ userId: "user-1" }],
            organizations: [{ id: "org-1", name: "Org 1", slug: "org-1" }],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original title")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "保存する" })[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const patchCall = vi
      .mocked(apiFetch)
      .mock.calls.find(
        (call) =>
          call[0] === "/api/papers/paper-1" && call[1]?.method === "PATCH",
      );
    const payload = JSON.parse(String(patchCall?.[1]?.body));
    expect(payload.visibility).toBe("org_only");
    expect(payload.orgIds).toBeUndefined();
  });

  it("shows warning when org list fetch fails", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/users/me/orgs") {
        return new Response("error", { status: 500 });
      }

      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Original title",
              abstract: null,
              visibility: "private",
              showViewCount: false,
              language: null,
              externalUrl: null,
              doi: null,
              venue: null,
              venueType: null,
              year: null,
              category: null,
              tags: null,
            },
            authors: [{ userId: "user-1" }],
            organizations: [],
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original title")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/組織情報の取得に失敗しました（status: 500）/),
    ).toBeInTheDocument();
  });
});
