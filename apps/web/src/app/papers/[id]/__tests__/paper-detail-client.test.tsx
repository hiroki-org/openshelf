import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaperDetailClient from "../paper-detail-client";
import { apiFetch } from "@/lib/api";

const toastSuccess = vi.fn();
const toastError = vi.fn();
let authState: any;
let objectUrlCount = 0;

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} {...props} />
  ),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicViewer(props: {
      fileUrl: string;
      onDownloadFallback: () => void;
    }) {
      const isPptx = props.fileUrl.endsWith(".pptx");
      return (
        <div
          data-testid={isPptx ? "pptx-viewer" : "pdf-viewer"}
          data-url={props.fileUrl}
        >
          <button type="button" onClick={props.onDownloadFallback}>
            fallback download
          </button>
        </div>
      );
    };
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function blobResponse(content: string, type: string, status = 200) {
  return new Response(new Blob([content], { type }), { status });
}

describe("PaperDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    objectUrlCount = 0;
    authState = { user: { id: "author-1" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const UrlMock = Object.assign(
      class extends URL {},
      {
        createObjectURL: vi.fn(() => {
          objectUrlCount += 1;
          return `blob:mock-${objectUrlCount}`;
        }),
        revokeObjectURL: vi.fn(),
      },
    ) as typeof URL;
    vi.stubGlobal("URL", UrlMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders author controls, previews assets, records views, and invites coauthors", async () => {
    const invites = [
      {
        id: "invite-1",
        inviteeId: "user-2",
        inviteeName: "Existing Invite",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/papers/paper-1" && method === "GET") {
        return jsonResponse({
          paper: {
            id: "paper-1",
            title: "Transformer Tricks",
            abstract: "Paper abstract",
            visibility: "public",
            showViewCount: true,
            publicViewCount: 10,
            externalUrl: "https://example.com/paper",
            venue: "NeurIPS",
            venueType: "conference",
            year: 2025,
            category: "report",
            tags: "[\"ai\"]",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          files: [
            {
              id: "file-pdf",
              filename: "paper.pdf",
              fileType: "paper",
              sizeBytes: 1024,
              mimeType: "application/pdf",
              downloadUrl: "/api/downloads/paper.pdf",
            },
            {
              id: "file-image",
              filename: "poster.png",
              fileType: "poster",
              sizeBytes: 2048,
              mimeType: "image/png",
              downloadUrl: "/api/downloads/poster.png",
            },
            {
              id: "file-slides",
              filename: "deck.pptx",
              fileType: "slides",
              sizeBytes: 4096,
              mimeType:
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              downloadUrl: "/api/downloads/deck.pptx",
            },
            {
              id: "file-dataset",
              filename: "dataset.bin",
              fileType: "dataset",
              sizeBytes: 2 * 1024 * 1024,
              mimeType: null,
              downloadUrl: "/api/downloads/dataset.bin",
            },
          ],
          authors: [
            {
              userId: "author-1",
              role: "uploader",
              name: "alice",
              displayName: "Alice",
              avatarUrl: null,
            },
            {
              userId: "author-2",
              role: "coauthor",
              name: "bob",
              displayName: "Bob",
              avatarUrl: null,
            },
          ],
        });
      }

      if (url === "/api/papers/paper-1/view" && method === "POST") {
        return jsonResponse({ counted: true });
      }

      if (url === "/api/papers/paper-1/stats" && method === "GET") {
        return jsonResponse({
          totalViews: 12,
          last7DaysViews: 4,
          last30DaysViews: 9,
          dailyViews: [
            { date: "2026-03-01", count: 1 },
            { date: "2026-03-02", count: 3 },
            { date: "2026-03-03", count: 2 },
          ],
        });
      }

      if (url === "/api/papers/paper-1/invites" && method === "GET") {
        return jsonResponse({ invites });
      }

      if (url.includes("/files/file-pdf/preview") && method === "GET") {
        return jsonResponse({
          url: "/api/previews/paper.pdf",
          mimeType: "application/pdf",
          filename: "paper.pdf",
        });
      }

      if (url.includes("/previews/paper.pdf") && method === "GET") {
        return blobResponse("preview", "application/pdf");
      }

      if (url.includes("/files/file-image/stream") && method === "GET") {
        return blobResponse("image", "image/png");
      }

      if (url === "/api/users/search?q=bo" && method === "GET") {
        return jsonResponse({
          users: [
            {
              id: "user-3",
              name: "bobcat",
              displayName: "Bob Candidate",
              avatarUrl: null,
            },
          ],
        });
      }

      if (url === "/api/papers/paper-1/invites" && method === "POST") {
        invites.push({
          id: "invite-2",
          inviteeId: "user-3",
          inviteeName: "Bob Candidate",
          status: "pending",
          createdAt: "2026-03-03T00:00:00.000Z",
        });
        return jsonResponse({ ok: true });
      }

      if (
        (url === "/api/downloads/paper.pdf" ||
          url === "/api/downloads/poster.png" ||
          url === "/api/downloads/deck.pptx" ||
          url === "/api/downloads/dataset.bin") &&
        method === "GET"
      ) {
        return blobResponse("download", "application/octet-stream");
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(<PaperDetailClient paperId="paper-1" />);

    await screen.findByRole("heading", { name: "Transformer Tricks" });
    expect(await screen.findByText("公開表示中の総閲覧数")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/papers/paper-1/view", {
        method: "POST",
      });
    });

    expect(await screen.findByText("11")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/papers/paper-1/files/file-image/stream",
        );
      },
      { timeout: 10000 },
    );
    expect(screen.getByRole("link", { name: /正式版はこちら/ })).toHaveAttribute(
      "href",
      "https://example.com/paper",
    );
    expect(screen.getByText("PPTXプレビュー")).toBeInTheDocument();
    expect(screen.getByTestId("pptx-viewer")).toHaveAttribute(
      "data-url",
      "/api/downloads/deck.pptx",
    );
    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
    expect(screen.getByText("🎞️")).toBeInTheDocument();
    expect(screen.getByText("閲覧統計")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3/2")).toBeInTheDocument();

    const datasetRow = screen.getByText("dataset.bin").closest("li");
    expect(datasetRow).not.toBeNull();
    expect(within(datasetRow!).getByText("📄")).toBeInTheDocument();
    expect(within(datasetRow!).getByText("2.0 MB")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("pdf-viewer")).getByRole("button", {
        name: "fallback download",
      }),
    );
    await waitFor(() => {
      expect(
        vi.mocked(apiFetch).mock.calls.some(([input]) =>
          String(input).includes("/api/downloads/paper.pdf"),
        ),
      ).toBe(true);
    });

    fireEvent.click(
      within(screen.getByTestId("pptx-viewer")).getByRole("button", {
        name: "fallback download",
      }),
    );
    await waitFor(() => {
      expect(
        vi.mocked(apiFetch).mock.calls.some(([input]) =>
          String(input).includes("/api/downloads/deck.pptx"),
        ),
      ).toBe(true);
    });

    const slideRow = screen.getByText("deck.pptx").closest("li");
    expect(slideRow).not.toBeNull();
    fireEvent.click(within(slideRow!).getByRole("button", { name: "ダウンロード" }));

    await waitFor(() => {
      expect(
        vi.mocked(apiFetch).mock.calls.some(([input]) =>
          String(input).includes("/api/downloads/deck.pptx"),
        ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "+ 共著者を招待" }));
    fireEvent.change(screen.getByPlaceholderText("ユーザー名で検索..."), {
      target: { value: "bo" },
    });

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(
      screen.queryByPlaceholderText("ユーザー名で検索..."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ 共著者を招待" }));
    fireEvent.change(screen.getByPlaceholderText("ユーザー名で検索..."), {
      target: { value: "bo" },
    });

    fireEvent.click(await screen.findByRole("button", { name: "招待" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("招待を送信しました");
    });

    expect(await screen.findByText("Bob Candidate")).toBeInTheDocument();
  }, 15000);

  it("shows the preview fallback UI and download permission errors", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/papers/paper-1" && method === "GET") {
        return jsonResponse({
          paper: {
            id: "paper-1",
            title: "Fallback Preview",
            abstract: null,
            visibility: "private",
            showViewCount: false,
            publicViewCount: null,
            externalUrl: null,
            venue: null,
            venueType: null,
            year: null,
            category: null,
            tags: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          files: [
            {
              id: "file-pdf",
              filename: "restricted.pdf",
              fileType: "paper",
              sizeBytes: 1024,
              mimeType: "application/pdf",
              downloadUrl: "/api/downloads/restricted.pdf",
            },
          ],
          authors: [
            {
              userId: "author-1",
              role: "author",
              name: "alice",
              displayName: "Alice",
              avatarUrl: null,
            },
          ],
        });
      }

      if (url === "/api/papers/paper-1/view" && method === "POST") {
        return jsonResponse({ counted: false });
      }

      if (url === "/api/papers/paper-1/stats" && method === "GET") {
        return jsonResponse({
          totalViews: 0,
          last7DaysViews: 0,
          last30DaysViews: 0,
          dailyViews: [],
        });
      }

      if (url.includes("/files/file-pdf/preview") && method === "GET") {
        return new Response("preview failed", { status: 500 });
      }

      if (url === "/api/downloads/restricted.pdf" && method === "GET") {
        return new Response("forbidden", { status: 403 });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(<PaperDetailClient paperId="paper-1" />);

    await screen.findByRole("heading", { name: "Fallback Preview" });
    expect(await screen.findByText("プレビューを読み込めません")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ダウンロードする" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このファイルをダウンロードする権限がありません",
      );
    });
  });

  it("maps paper fetch errors to user-facing messages", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("forbidden", { status: 403 }));

    render(<PaperDetailClient paperId="paper-1" />);

    expect(
      await screen.findByText("この論文を閲覧する権限がありません"),
    ).toBeInTheDocument();
  });
});
