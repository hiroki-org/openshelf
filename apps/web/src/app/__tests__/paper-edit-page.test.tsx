import { cleanup } from '@testing-library/react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

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
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
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
        }),
        { status: 200 },
      ),
    );

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/papers/paper-1");
    });
  });

  it("shows validation error when title is empty", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: { title: "Original", visibility: "public", showViewCount: false, tags: null },
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("タイトルを入力してください。")).toBeInTheDocument();
    });
    // Only GET was called, PATCH was not. The exact count can vary due to re-renders fetching, so we verify PATCH is not called.
    expect(apiFetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "PATCH" }));
  });

  it("shows validation error when title exceeds 300 characters", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: { title: "Original", visibility: "public", showViewCount: false, tags: null },
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Original")).toBeInTheDocument();
    });

    const longTitle = "A".repeat(301);
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: longTitle } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("タイトルは300文字以内で入力してください。")).toBeInTheDocument();
    });
  });

  it("shows validation error when abstract exceeds 5000 characters", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: { title: "Valid Title", abstract: "", visibility: "public", showViewCount: false, tags: null },
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Valid Title")).toBeInTheDocument();
    });

    const longAbstract = "A".repeat(5001);
    fireEvent.change(screen.getByLabelText(/概要/i), { target: { value: longAbstract } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("概要は5000文字以内で入力してください。")).toBeInTheDocument();
    });
  });

  it("handles non-array valid JSON and invalid JSON tags gracefully", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Test Tags",
              visibility: "public",
              showViewCount: false,
              tags: '{"not": "an array"}', // valid JSON, not an array
            },
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const { unmount } = render(<PaperEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Tags")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/タグ/i)).toHaveValue('[object Object]'); // Falls back to String(parsed)

    unmount();

    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (url === "/api/papers/paper-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            paper: {
              title: "Test Invalid JSON",
              visibility: "public",
              showViewCount: false,
              tags: 'invalid-json, test', // invalid JSON string
            },
            authors: [{ userId: "user-1" }],
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(<PaperEditPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Invalid JSON")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/タグ/i)).toHaveValue('invalid-json, test'); // Falls back to String(initialData.tags)
  });
});