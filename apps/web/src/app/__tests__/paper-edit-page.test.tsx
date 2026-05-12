import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("loads paper data and submits updates", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Original title",
              abstract: "Original abstract",
              description: "## Original description",
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
          }),
          { status: 200 },
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }

      if (url === "/api/papers/paper-1/description" && init?.method === "PUT") {
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

    expect(screen.getByText(`${"Updated title".length}/300`)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/概要/i), {
      target: { value: "Updated abstract" },
    });

    expect(screen.getByText(`${"Updated abstract".length}/5000`)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/公開ページに閲覧数を表示する/i));
    fireEvent.change(screen.getByLabelText(/タグ/i), {
      target: { value: "AI, LLM" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "## Updated description" },
    });
    fireEvent.change(screen.getByLabelText(/発表年/i), {
      target: { value: "2026" },
    });
    fireEvent.change(screen.getByLabelText(/発表場所/i), {
      target: { value: "Updated Conference" },
    });
    fireEvent.change(screen.getByLabelText(/発表種別/i), {
      target: { value: "journal" },
    });
    fireEvent.change(screen.getByLabelText(/^言語$/i), {
      target: { value: "en" },
    });
    fireEvent.change(screen.getByLabelText(/DOI/i), {
      target: { value: "10.1000/xyz123" },
    });
    fireEvent.change(screen.getByLabelText(/外部リンク/i), {
      target: { value: "https://example.com/paper" },
    });
    fireEvent.change(screen.getByLabelText(/カテゴリ/i), {
      target: { value: "presentation" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/papers/paper-1/description",
      expect.objectContaining({ method: "PUT" }),
    );
    const patchCall = vi
      .mocked(apiFetch)
      .mock.calls.find(
        ([url, init]) => url === "/api/papers/paper-1" && init?.method === "PATCH",
      );
    const patchBody = JSON.parse((patchCall?.[1]?.body as string) ?? "{}");
    expect(patchBody).toMatchObject({
      title: "Updated title",
      abstract: "Updated abstract",
      visibility: "private",
      showViewCount: true,
      language: "en",
      externalUrl: "https://example.com/paper",
      doi: "10.1000/xyz123",
      venue: "Updated Conference",
      venueType: "journal",
      year: 2026,
      category: "presentation",
      tags: ["AI", "LLM"],
    });

    expect(push).toHaveBeenCalledWith("/papers/paper-1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("redirects non-authors back to the paper page", async () => {
    Object.defineProperty(window, "location", {
      value: { assign: vi.fn() },
      writable: true,
    });
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          paper: {
            title: "Original title",
            abstract: null,
            description: null,
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
        }),
        { status: 200 },
      ),
    );

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/papers/paper-1");
    });
  });
});
