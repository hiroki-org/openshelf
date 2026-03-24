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

class MockDataTransfer {
  files: File[] = [];
}

global.DataTransfer = MockDataTransfer as any;

describe("UploadPage", () => {
  afterEach(() => {
    cleanup();
  });

  const setupApiMocks = ({
    paperResponse,
    orgs = [
      { id: "org-1", name: "Org 1", slug: "org-1", role: "member" },
      { id: "org-2", name: "Org 2", slug: "org-2", role: "admin" },
    ],
  }: {
    paperResponse?: Promise<Response>;
    orgs?: { id: string; name: string; slug: string; role: string }[];
  } = {}): void => {
    vi.mocked(apiFetch).mockImplementation((url): Promise<Response> => {
      if (url === "/api/users/me/orgs") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              organizations: orgs,
            }),
            { status: 200 },
          ),
        );
      }
      if (url === "/api/papers") {
        return paperResponse || Promise.resolve(new Response("{}"));
      }
      return Promise.resolve(new Response("{}"));
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    authState = { user: { id: "user-1" }, loading: false };
    // Default mock for organization fetch
    setupApiMocks();
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
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    expect(
      await screen.findByText(/ファイルを1つ以上添付してください/i),
    ).toBeInTheDocument();
  });

  it("validates that title is present", async () => {
    render(<UploadPage />);

    // Add a file but keep title empty
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [new File(["F"], "f.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.submit(
      screen
        .getByRole("button", { name: "論文をアップロードする" })
        .closest("form")!,
    );

    expect(await screen.findByText("タイトルは必須です")).toBeInTheDocument();
  });

  it("submits metadata and attached files", async () => {
    setupApiMocks({
      paperResponse: Promise.resolve(
        new Response(JSON.stringify({ paper: { id: "paper-1" } }), {
          status: 201,
        }),
      ),
    });

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

    fireEvent.click(
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const formData = (
      vi
        .mocked(apiFetch)
        .mock.calls.find((call) => call[0] === "/api/papers")![1] as any
    ).body as FormData;
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

  it("accepts drag and drop uploads while filtering invalid extensions", async () => {
    render(<UploadPage />);

    const dropzone = screen
      .getByText("ファイルを複数選択")
      .closest("button") as HTMLButtonElement;
    const validFile = new File(["PDF"], "paper.pdf", {
      type: "application/pdf",
    });
    const invalidFile = new File(["EXE"], "malicious.exe", {
      type: "application/x-msdownload",
    });

    fireEvent.dragOver(dropzone, {
      dataTransfer: { files: [validFile, invalidFile] },
    });
    expect(dropzone.className).toContain("border-gray-500");

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validFile, invalidFile] },
    });

    expect(await screen.findByText("paper.pdf")).toBeInTheDocument();
    expect(screen.queryByText("malicious.exe")).not.toBeInTheDocument();
    expect(dropzone.className).not.toContain("border-gray-500");
  });

  it("handles network error during upload", async () => {
    setupApiMocks({
      paperResponse: Promise.reject(new Error("Network Error")),
    });

    render(<UploadPage />);
    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText("アップロードファイル"), {
      target: {
        files: [new File(["F"], "f.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    expect(
      await screen.findByText("ネットワークエラーが発生しました"),
    ).toBeInTheDocument();
  });

  it("handles api error response", async () => {
    setupApiMocks({
      paperResponse: Promise.resolve(
        new Response(JSON.stringify({ error: "Server Error" }), {
          status: 500,
        }),
      ),
    });

    render(<UploadPage />);
    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "T" },
    });
    fireEvent.change(screen.getByLabelText("アップロードファイル"), {
      target: {
        files: [new File(["F"], "f.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    expect(await screen.findByText("Server Error")).toBeInTheDocument();
  });

  it("handles complex metadata and redirects", async () => {
    setupApiMocks({
      paperResponse: Promise.resolve(
        new Response(JSON.stringify({ paper: { id: "p2" } }), { status: 201 }),
      ),
    });

    render(<UploadPage />);

    // Fill metadata
    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "Complex Paper" },
    });
    fireEvent.change(screen.getByLabelText("概要"), {
      target: { value: "Abstract text" },
    });
    fireEvent.change(screen.getByLabelText("発表年"), {
      target: { value: "2026" },
    });
    fireEvent.change(screen.getByLabelText("会場名"), {
      target: { value: "Conference" },
    });
    fireEvent.change(screen.getByLabelText("タグ（カンマ区切り）"), {
      target: { value: "tag1, tag2" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    // Files
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [new File(["DATA"], "data.pdf", { type: "application/pdf" })],
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const formData = (
        vi.mocked(apiFetch).mock.calls[
          vi.mocked(apiFetch).mock.calls.length - 1
        ][1] as any
      ).body as FormData;
      const meta = JSON.parse(formData.get("metadata") as string);
      expect(meta.title).toBe("Complex Paper");
      expect(meta.abstract).toBe("Abstract text");
      expect(meta.venue).toBe("Conference");
      expect(meta.year).toBe(2026);
      expect(meta.tags).toEqual(["tag1", "tag2"]);
      expect(meta.showViewCount).toBe(true);
      expect(push).toHaveBeenCalledWith("/papers/p2");
    });
  });

  it("shows organization dropdown when visibility is org_only", async () => {
    render(<UploadPage />);

    // Initially, org select should not be visible
    expect(screen.queryByLabelText(/対象組織/i)).not.toBeInTheDocument();

    // Change visibility to org_only
    fireEvent.change(screen.getByLabelText("公開範囲"), {
      target: { value: "org_only" },
    });

    // Now org select should be visible
    const orgSelect = await screen.findByLabelText(/対象組織/i);
    expect(orgSelect).toBeInTheDocument();

    // Should contain the mocked organizations
    await waitFor(() => {
      expect(screen.getByText("Org 1")).toBeInTheDocument();
      expect(screen.getByText("Org 2")).toBeInTheDocument();
    });
  });

  it("hides organization dropdown when visibility is not org_only", async () => {
    render(<UploadPage />);

    // Change to org_only
    fireEvent.change(screen.getByLabelText("公開範囲"), {
      target: { value: "org_only" },
    });
    await screen.findByLabelText(/対象組織/i);

    // Change back to private
    fireEvent.change(screen.getByLabelText("公開範囲"), {
      target: { value: "private" },
    });

    // Org select should disappear
    expect(screen.queryByLabelText(/対象組織/i)).not.toBeInTheDocument();
  });

  it("validates that organization is required when visibility is org_only", async () => {
    render(<UploadPage />);

    // Fill title and add file
    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "My paper" },
    });
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [new File(["F"], "f.pdf", { type: "application/pdf" })],
      },
    });

    // Change visibility to org_only
    fireEvent.change(screen.getByLabelText("公開範囲"), {
      target: { value: "org_only" },
    });

    // Try to submit without selecting organization
    const submitButton = screen.getByRole("button", {
      name: "論文をアップロードする",
    });
    fireEvent.click(submitButton);

    // Should show validation error
    expect(
      await screen.findByText(/組織を選択してください/i),
    ).toBeInTheDocument();
  });

  it("includes orgId in metadata when org_only is selected with organization", async () => {
    setupApiMocks({
      paperResponse: Promise.resolve(
        new Response(JSON.stringify({ paper: { id: "paper-1" } }), {
          status: 201,
        }),
      ),
      orgs: [
        { id: "org-1", name: "Org 1", slug: "org-1", role: "member" },
      ],
    });

    render(<UploadPage />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/タイトル/i), {
      target: { value: "Org Paper" },
    });
    const input = screen.getByLabelText("アップロードファイル");
    fireEvent.change(input, {
      target: {
        files: [new File(["F"], "f.pdf", { type: "application/pdf" })],
      },
    });

    // Change visibility to org_only
    fireEvent.change(screen.getByLabelText("公開範囲"), {
      target: { value: "org_only" },
    });

    // Select organization
    const orgSelect = await screen.findByLabelText(/対象組織/i);
    fireEvent.change(orgSelect, { target: { value: "org-1" } });

    // Submit
    fireEvent.click(
      screen.getByRole("button", { name: "論文をアップロードする" }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers",
        expect.objectContaining({
          method: "POST",
        }),
      );

      // Find the /api/papers call (not the /api/users/me/orgs call)
      const paperCall = vi
        .mocked(apiFetch)
        .mock.calls.find((call) => call[0] === "/api/papers");
      expect(paperCall).toBeDefined();

      const formData = (paperCall![1] as any).body as FormData;
      const meta = JSON.parse(formData.get("metadata") as string);
      expect(meta.visibility).toBe("org_only");
      expect(meta.orgId).toBe("org-1");
    });
  });

  it("shows error message when organization fetch fails", async () => {
    vi.mocked(apiFetch).mockImplementation((url) => {
      if (url === "/api/users/me/orgs") {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
          }),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UploadPage />);

    // Should display error message
    expect(
      await screen.findByText("組織情報の取得中にサーバーエラーが発生しました。ページを再読み込みしてください。"),
    ).toBeInTheDocument();
  });
});
