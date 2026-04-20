import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    fireEvent.click(screen.getByLabelText(/公開ページに閲覧数を表示する/i));
    fireEvent.change(screen.getByLabelText(/タグ/i), {
      target: { value: "AI, LLM" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "## Updated description" },
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

    expect(push).toHaveBeenCalledWith("/papers/paper-1");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("redirects non-authors back to the paper page", async () => {
    Object.defineProperty(window, "location", { value: { assign: vi.fn(), href: "" }, writable: true, configurable: true });
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
