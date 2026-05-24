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
  afterEach(() => {
    cleanup();
  });

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
      target: { value: "AI，LLM、CV" },
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
      tags: ["AI", "LLM", "CV"],
    });

    expect(push).toHaveBeenCalledWith("/papers/paper-1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner while saving edits", async () => {
    let resolvePatch!: (value: Response) => void;
    vi.mocked(apiFetch).mockImplementation((url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return Promise.resolve(
          new Response(
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
          ),
        );
      }

      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Promise((resolve) => {
          resolvePatch = resolve;
        });
      }

      if (url === "/api/papers/paper-1/description" && init?.method === "PUT") {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }

      return Promise.reject(new Error(`Unexpected request: ${String(url)}`));
    });

    const { container } = render(<PaperEditPage />);

    await screen.findByDisplayValue("Original title");

    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByRole("button", { name: "保存中..." }),
    ).toBeDisabled();
    expect(
      container.querySelector('[aria-hidden="true"].motion-safe\\:animate-spin'),
    ).toBeInTheDocument();

    resolvePatch(new Response("{}", { status: 200 }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/papers/paper-1");
    });
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

  it("redirects guests to home when auth is resolved", async () => {
    authState = { user: null, loading: false };

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("redirects to home when paper fetch returns unauthorized", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 401 }));

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });

  it("shows fetch error message when paper loading fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));

    render(<PaperEditPage />);

    expect(
      await screen.findByText("成果物の取得に失敗しました"),
    ).toBeInTheDocument();
  });

  it("prevents submit when title is blank", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
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
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("タイトルを入力してください。")).toBeInTheDocument();
    const patchCalls = vi
      .mocked(apiFetch)
      .mock.calls.filter(
        ([url, req]) => url === "/api/papers/paper-1" && req?.method === "PATCH",
      );
    expect(patchCalls).toHaveLength(0);
  });

  it("submits null year when year field is cleared", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
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
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/発表年/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    const patchCall = await waitFor(() =>
      vi
        .mocked(apiFetch)
        .mock.calls.find(
          ([url, req]) => url === "/api/papers/paper-1" && req?.method === "PATCH",
        ),
    );
    const patchBody = JSON.parse((patchCall?.[1]?.body as string) ?? "{}");
    expect(patchBody.year).toBeNull();
  });

  it("shows server error returned from metadata update", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
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
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 },
        );
      }
      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response(JSON.stringify({ error: "メタデータ失敗" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("メタデータ失敗")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows description-specific error when description save fails", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
              abstract: null,
              description: "old",
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
          }),
          { status: 200 },
        );
      }
      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }
      if (url === "/api/papers/paper-1/description" && init?.method === "PUT") {
        return new Response(JSON.stringify({ error: "desc-failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText(
        "メタデータは保存されましたが、Description の保存に失敗しました。再度お試しください。（詳細: desc-failed）",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to raw tag text when initial tags are not JSON", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
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
              tags: "AI|NLP",
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
    await screen.findByDisplayValue("Initial");
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    const patchCall = await waitFor(() =>
      vi
        .mocked(apiFetch)
        .mock.calls.find(
          ([url, req]) => url === "/api/papers/paper-1" && req?.method === "PATCH",
        ),
    );
    const patchBody = JSON.parse((patchCall?.[1]?.body as string) ?? "{}");
    expect(patchBody.tags).toEqual(["AI|NLP"]);
  });

  it("shows default metadata update error when server returns non-json body", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
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
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 },
        );
      }
      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("bad-request", { status: 400 });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText("メタデータの更新に失敗しました"),
    ).toBeInTheDocument();
  });

  it("shows default description failure reason when response has no error field", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Initial",
              abstract: null,
              description: "old",
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
          }),
          { status: 200 },
        );
      }
      if (url === "/api/papers/paper-1" && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }
      if (url === "/api/papers/paper-1/description" && init?.method === "PUT") {
        return new Response(JSON.stringify({ detail: "missing" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected request: ${String(url)}`);
    });

    render(<PaperEditPage />);
    expect(await screen.findByDisplayValue("Initial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText(
        "メタデータは保存されましたが、Description の保存に失敗しました。再度お試しください。（詳細: Description の更新に失敗しました）",
      ),
    ).toBeInTheDocument();
  });

  it("shows loading spinner while auth is resolving", () => {
    authState = { user: null, loading: true };

    const { container } = render(<PaperEditPage />);
    expect(container.querySelector(".motion-safe\\:animate-spin")).not.toBeNull();
  });
});
