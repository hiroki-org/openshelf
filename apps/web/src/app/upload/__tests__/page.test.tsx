import {
  cleanup,
  createEvent,
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
      target: { value: "AI，LLM、CV" },
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
      tags: ["AI", "LLM", "CV"],
    });
    expect(formData.get("file_types_0")).toBe("paper");
    expect(formData.get("files_0")).toBeInstanceOf(File);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/papers/paper-1");
    });
  });

  it("handles drag and drop events for file upload", async () => {
    render(<UploadPage />);

    // initially normal text
    expect(
      screen.getByText("ファイルを複数選択（またはドラッグ＆ドロップ）"),
    ).toBeInTheDocument();

    const dropzone = screen.getByRole("button", {
      description: /添付ファイル/i,
    });

    // simulate drag enter
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        types: ["Files"],
      },
    });
    expect(screen.getByText("ドロップして追加")).toBeInTheDocument();

    // moving across children should not clear the active drag state
    const child = dropzone.querySelector("span");
    const internalDragLeave = createEvent.dragLeave(dropzone);
    Object.defineProperty(internalDragLeave, "relatedTarget", {
      value: child,
    });
    fireEvent(dropzone, internalDragLeave);
    expect(screen.getByText("ドロップして追加")).toBeInTheDocument();

    // simulate drag leave outside
    fireEvent.dragLeave(dropzone);
    expect(
      screen.getByText("ファイルを複数選択（またはドラッグ＆ドロップ）"),
    ).toBeInTheDocument();

    // simulate drag enter again
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        types: ["Files"],
      },
    });
    expect(screen.getByText("ドロップして追加")).toBeInTheDocument();

    // simulate drop
    const file = new File(["dummy content"], "test.pdf", {
      type: "application/pdf",
    });
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    // text should reset to normal
    expect(
      screen.getByText("ファイルを複数選択（またはドラッグ＆ドロップ）"),
    ).toBeInTheDocument();

    // file should be added
    expect(await screen.findByText("test.pdf")).toBeInTheDocument();
  });

  it("shows specific server error when upload fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid metadata provided" }), {
        status: 400,
      }),
    );

    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "My paper" },
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

    expect(
      await screen.findByText("Invalid metadata provided"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("shows default error when upload fails without specific error", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 500,
      }),
    );

    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "My paper" },
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

    expect(
      await screen.findByText("アップロードに失敗しました"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("shows network error when fetch rejects", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("ネットワークエラーが発生しました"));

    render(<UploadPage />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "My paper" },
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

    expect(
      await screen.findByText("ネットワークエラーが発生しました"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("does not show drop feedback for non-file drags", () => {
    render(<UploadPage />);

    const dropzone = screen.getByRole("button", {
      description: /添付ファイル/i,
    });

    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        types: ["text/plain"],
      },
    });

    expect(
      screen.getByText("ファイルを複数選択（またはドラッグ＆ドロップ）"),
    ).toBeInTheDocument();
    expect(screen.queryByText("ドロップして追加")).not.toBeInTheDocument();
  });

  it("filters unsupported files dropped into the upload area", async () => {
    render(<UploadPage />);

    const dropzone = screen.getByRole("button", {
      description: /添付ファイル/i,
    });

    const validFile = new File(["%PDF-1.7"], "paper.pdf", {
      type: "application/pdf",
    });
    const invalidFile = new File(["doc"], "notes.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [validFile, invalidFile],
      },
    });

    expect(
      await screen.findByText("対応していないファイル形式は除外しました"),
    ).toBeInTheDocument();
    expect(screen.getByText("paper.pdf")).toBeInTheDocument();
    expect(screen.queryByText("notes.docx")).not.toBeInTheDocument();
  });

  it("rejects files with unsupported MIME types", async () => {
    render(<UploadPage />);

    const dropzone = screen.getByRole("button", {
      description: /添付ファイル/i,
    });

    const disguisedFile = new File(["MZ"], "evil.pdf", {
      type: "application/x-msdownload",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [disguisedFile],
      },
    });

    expect(
      await screen.findByText("対応していないファイル形式です"),
    ).toBeInTheDocument();
    expect(screen.queryByText("evil.pdf")).not.toBeInTheDocument();
  });

  it("accepts supported extensions when the browser omits MIME type", async () => {
    render(<UploadPage />);

    const dropzone = screen.getByRole("button", {
      description: /添付ファイル/i,
    });

    const fileWithoutType = new File(["slides"], "slides.pptx");

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [fileWithoutType],
      },
    });

    expect(await screen.findByText("slides.pptx")).toBeInTheDocument();
  });
});
