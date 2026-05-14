import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UploadPage from "../page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
let authState: any;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("UploadPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { user: { id: "user-1", name: "Alice" }, loading: false };
    push.mockReset();
  });

  it("redirects guests to the home page", async () => {
    authState = { user: null, loading: false };

    render(<UploadPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  it("validates that at least one file is attached", async () => {
    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "My paper" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "成果物をアップロードする" }),
    );

    expect(
      await screen.findByText("ファイルを1つ以上添付してください"),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("submits metadata and attached files", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ paper: { id: "paper-1" } }), {
        status: 200,
      }),
    );

    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "  My paper  " },
    });
    expect(
      screen.getByText(`${"  My paper  ".length}/300`),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/概要/i), {
      target: { value: "Abstract" },
    });
    expect(screen.getByText(`${"Abstract".length}/5000`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/発表年/i), {
      target: { value: "2025" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /公開ページに閲覧数を表示する/i,
      }),
    );
    fireEvent.change(screen.getByLabelText(/タグ（カンマ区切り）/i), {
      target: { value: "AI, LLM" },
    });

    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["%PDF-1.7"], "paper.pdf", { type: "application/pdf" }),
        ],
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "成果物をアップロードする" }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const postCall = vi
      .mocked(apiFetch)
      .mock.calls.find(
        ([url, init]) => url === "/api/papers" && init?.method === "POST",
      );
    expect(postCall).toBeDefined();

    const body = postCall?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    const metadata = JSON.parse(String(formData.get("metadata")));

    expect(metadata).toEqual({
      title: "My paper",
      abstract: "Abstract",
      visibility: "private",
      showViewCount: true,
      venue: null,
      venueType: null,
      year: 2025,
      category: null,
      tags: ["AI", "LLM"],
    });
    expect(formData.get("file_types_0")).toBe("paper");
    expect(formData.get("files_0")).toBeInstanceOf(File);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/papers/paper-1");
    });
  });
});
