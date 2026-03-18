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
let authState: { user: any; loading: boolean } = {
  user: { id: "user-1" },
  loading: false,
};

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
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
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
    fireEvent.click(screen.getByRole("button", { name: "論文をアップロードする" }));

    expect(
      await screen.findByText(/ファイルを1つ以上添付してください/i),
    ).toBeInTheDocument();
  });

  it("validates that title is present", async () => {
    render(<UploadPage />);
    
    // Add a file but keep title empty
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: { files: [new File(["F"], "f.pdf", { type: "application/pdf" })] },
    });

    fireEvent.submit(screen.getByRole("button", { name: "論文をアップロードする" }).closest("form")!);

    expect(await screen.findByText("タイトルは必須です")).toBeInTheDocument();
  });

  it("submits metadata and attached files", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ paper: { id: "paper-1" } }), { status: 201 }),
    );

    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "  My paper  " },
    });
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [new File(["DATA"], "data.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "論文をアップロードする" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const formData = (vi.mocked(apiFetch).mock.calls[0][1] as any)
      .body as FormData;
    const meta = JSON.parse(formData.get("metadata") as string);
    expect(meta.title).toBe("My paper");
    expect(meta.visibility).toBe("private");
    expect(formData.get("file_types_0")).toBe("paper");
    expect(formData.get("files_0")).toBeInstanceOf(File);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/papers/paper-1");
    });
  });

  it("handles file removal and file type change", async () => {
    render(<UploadPage />);

    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [
          new File(["F1"], "f1.pdf", { type: "application/pdf" }),
          new File(["F2"], "f2.pdf", { type: "application/pdf" }),
        ],
      },
    });

    expect(screen.getByText("f1.pdf")).toBeInTheDocument();
    expect(screen.getByText("f2.pdf")).toBeInTheDocument();

    const fileTypeSelects = screen.getAllByLabelText("ファイル種別");
    fireEvent.change(fileTypeSelects[0], { target: { value: "slides" } });
    expect(fileTypeSelects[0]).toHaveValue("slides");

    const removeButtons = screen.getAllByRole("button", { name: "✕" });
    fireEvent.click(removeButtons[1]); // Remove f2.pdf

    expect(screen.queryByText("f2.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("f1.pdf")).toBeInTheDocument();
  });

  it("handles network error during upload", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Network Error"));

    render(<UploadPage />);
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText("アップロードファイル"), {
      target: { files: [new File(["F"], "f.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "論文をアップロードする" }));

    expect(await screen.findByText("ネットワークエラーが発生しました")).toBeInTheDocument();
  });

  it("handles api error response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Server Error" }), { status: 500 }),
    );

    render(<UploadPage />);
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText("アップロードファイル"), {
      target: { files: [new File(["F"], "f.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "論文をアップロードする" }));

    expect(await screen.findByText("Server Error")).toBeInTheDocument();
  });

  it("handles complex metadata and redirects", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ paper: { id: "p2" } }), { status: 201 }),
    );

    render(<UploadPage />);

    // Fill metadata
    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Complex Paper" } });
    fireEvent.change(screen.getByLabelText("概要"), { target: { value: "Abstract text" } });
    fireEvent.change(screen.getByLabelText("発表年"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("会場名"), { target: { value: "Conference" } });
    fireEvent.change(screen.getByLabelText("タグ（カンマ区切り）"), { target: { value: "tag1, tag2" } });

    // Files
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: { files: [new File(["DATA"], "data.pdf", { type: "application/pdf" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "論文をアップロードする" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const formData = (vi.mocked(apiFetch).mock.calls[0][1] as any).body as FormData;
      const meta = JSON.parse(formData.get("metadata") as string);
      expect(meta.title).toBe("Complex Paper");
      expect(meta.year).toBe(2026);
      expect(meta.tags).toEqual(["tag1", "tag2"]);
    });
  });
});
