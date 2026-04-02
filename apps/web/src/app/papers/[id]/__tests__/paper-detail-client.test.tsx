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
    return function MockPdfViewer(props: {
      fileUrl: string;
      onDownloadFallback: () => void;
    }) {
      return (
        <div data-testid="pdf-viewer" data-url={props.fileUrl}>
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
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });
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
            description:
              "## 再現手順\n\n```bash\nnpm run test\n```\n\n<script>alert('xss')</script>",
            descriptionUpdatedAt: "2026-03-01T00:00:00.000Z",
            visibility: "public",
            showViewCount: true,
            publicViewCount: 10,
            publicDownloadCount: 2,
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

      if (url === "/api/papers/paper-1/track" && method === "POST") {
        return new Response(null, { status: 204 });
      }

      if (url === "/api/papers/paper-1/stats?days=30" && method === "GET") {
        return jsonResponse({
          total: {
            views: 12,
            downloads: 5,
            previews: 2,
          },
          daily: [
            { date: "2026-03-01", views: 1, downloads: 0, previews: 0 },
            { date: "2026-03-02", views: 3, downloads: 1, previews: 0 },
            { date: "2026-03-03", views: 2, downloads: 1, previews: 0 },
          ],
          days: 30,
        });
      }

      if (url === "/api/papers/paper-1/invites" && method === "GET") {
        return jsonResponse({ invites });
      }

      if (url === "/api/papers/paper-1/files/file-pdf/preview" && method === "GET") {
        return jsonResponse({
          url: "/api/previews/paper.pdf",
          mimeType: "application/pdf",
          filename: "paper.pdf",
        });
      }

      if (url === "/api/previews/paper.pdf" && method === "GET") {
        return blobResponse("preview", "application/pdf");
      }

      if (url === "/api/papers/paper-1/files/file-image/stream" && method === "GET") {
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
          url === "/api/downloads/deck.pptx") &&
        method === "GET"
      ) {
        return blobResponse("download", "application/octet-stream");
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(
      <PaperDetailClient
        paperId="paper-1"
        siteBase="https://openshelf.example"
      />,
    );

    await screen.findByRole("heading", { name: "Transformer Tricks" });
    expect(
      await screen.findByText("公開表示中の閲覧・ダウンロード数"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1/track",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    expect(await screen.findByText("👁️ 10 views · 📥 2 downloads")).toBeInTheDocument();
    expect(await screen.findByTestId("pdf-viewer")).toHaveAttribute(
      "data-url",
      expect.stringMatching(/^blob:mock-/),
    );
    expect(screen.getByAltText("poster.png")).toHaveAttribute(
      "src",
      expect.stringMatching(/^blob:mock-/),
    );
    expect(screen.getByRole("link", { name: /正式版はこちら/ })).toHaveAttribute(
      "href",
      "https://example.com/paper",
    );
    expect(screen.getByText("Badge")).toBeInTheDocument();
    expect(
      screen.getByAltText("OpenShelf badge preview for Transformer Tricks"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("/badge/paper-1?style=default&label=OpenShelf"),
    );
    expect(screen.getByText("Markdown")).toBeInTheDocument();
    expect(screen.getByText("HTML")).toBeInTheDocument();
    expect(screen.getByText("shields.io")).toBeInTheDocument();
    const statsSection = screen.getByRole("heading", {
      name: "閲覧統計",
    }).closest("section");
    expect(statsSection).not.toBeNull();
    expect(within(statsSection!).getByText("12")).toBeInTheDocument();
    expect(within(statsSection!).getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3/2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByText("再現手順")).toBeInTheDocument();
    expect(screen.queryByText("alert('xss')")).not.toBeInTheDocument();

    const slideRow = screen.getByText("deck.pptx").closest("li");
    expect(slideRow).not.toBeNull();
    fireEvent.click(within(slideRow!).getByRole("button", { name: "ダウンロード" }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ 共著者を招待" }));
    fireEvent.change(screen.getByPlaceholderText("ユーザー名で検索..."), {
      target: { value: "bo" },
    });

    fireEvent.click(await screen.findByRole("button", { name: "招待" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("招待を送信しました");
    });

    expect(await screen.findByText("Bob Candidate")).toBeInTheDocument();
  });

  it("uses author stats in analytics summary when showViewCount is disabled", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/papers/paper-1" && method === "GET") {
        return jsonResponse({
          paper: {
            id: "paper-1",
            title: "Author Hidden Stats",
            abstract: null,
            visibility: "private",
            showViewCount: false,
            publicViewCount: null,
            publicDownloadCount: null,
            externalUrl: null,
            venue: null,
            venueType: null,
            year: null,
            category: null,
            tags: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          files: [],
          authors: [
            {
              userId: "author-1",
              role: "uploader",
              name: "alice",
              displayName: "Alice",
              avatarUrl: null,
            },
          ],
        });
      }

      if (url === "/api/papers/paper-1/track" && method === "POST") {
        return new Response(null, { status: 204 });
      }

      if (url === "/api/papers/paper-1/stats?days=30" && method === "GET") {
        return jsonResponse({
          total: {
            views: 42,
            downloads: 11,
            previews: 3,
          },
          daily: [],
          days: 30,
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(
      <PaperDetailClient
        paperId="paper-1"
        siteBase="https://openshelf.example"
      />,
    );

    await screen.findByRole("heading", { name: "Author Hidden Stats" });
    expect(await screen.findByText("著者向けの閲覧・ダウンロード数")).toBeInTheDocument();
    expect(await screen.findByText("👁️ 42 views · 📥 11 downloads")).toBeInTheDocument();
  });

  it("uses apiFetch for private paper tracking even when sendBeacon exists", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon } as unknown as Navigator);

    vi.mocked(apiFetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/api/papers/paper-1" && method === "GET") {
        return jsonResponse({
          paper: {
            id: "paper-1",
            title: "Private Tracking",
            abstract: null,
            visibility: "private",
            showViewCount: false,
            publicViewCount: null,
            publicDownloadCount: null,
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
              role: "uploader",
              name: "alice",
              displayName: "Alice",
              avatarUrl: null,
            },
          ],
        });
      }

      if (url === "/api/papers/paper-1/stats?days=30" && method === "GET") {
        return jsonResponse({
          total: { views: 1, downloads: 1, previews: 1 },
          daily: [],
          days: 30,
        });
      }

      if (url === "/api/papers/paper-1/files/file-pdf/preview" && method === "GET") {
        return jsonResponse({
          url: "/api/previews/restricted.pdf",
          mimeType: "application/pdf",
          filename: "restricted.pdf",
        });
      }

      if (url === "/api/previews/restricted.pdf" && method === "GET") {
        return blobResponse("preview", "application/pdf");
      }

      if (url === "/api/downloads/restricted.pdf" && method === "GET") {
        return blobResponse("download", "application/pdf");
      }

      if (url === "/api/papers/paper-1/track" && method === "POST") {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(
      <PaperDetailClient
        paperId="paper-1"
        siteBase="https://openshelf.example"
      />,
    );

    await screen.findByRole("heading", { name: "Private Tracking" });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/papers/paper-1/track",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(sendBeacon).not.toHaveBeenCalled();
  });

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
            description: null,
            descriptionUpdatedAt: null,
            visibility: "private",
            showViewCount: false,
            publicViewCount: null,
            publicDownloadCount: null,
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

      if (url === "/api/papers/paper-1/track" && method === "POST") {
        return new Response(null, { status: 204 });
      }

      if (url === "/api/papers/paper-1/stats?days=30" && method === "GET") {
        return jsonResponse({
          total: {
            views: 0,
            downloads: 0,
            previews: 0,
          },
          daily: [],
          days: 30,
        });
      }

      if (url === "/api/papers/paper-1/files/file-pdf/preview" && method === "GET") {
        return new Response("preview failed", { status: 500 });
      }

      if (url === "/api/downloads/restricted.pdf" && method === "GET") {
        return new Response("forbidden", { status: 403 });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    render(
      <PaperDetailClient
        paperId="paper-1"
        siteBase="https://openshelf.example"
      />,
    );

    await screen.findByRole("heading", { name: "Fallback Preview" });
    expect(await screen.findByText("プレビューを読み込めません")).toBeInTheDocument();
    expect(screen.queryByText("Badge")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ダウンロードする" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "このファイルをダウンロードする権限がありません",
      );
    });
  });

  it("maps paper fetch errors to user-facing messages", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("forbidden", { status: 403 }));

    render(
      <PaperDetailClient
        paperId="paper-1"
        siteBase="https://openshelf.example"
      />,
    );

    expect(
      await screen.findByText("この論文を閲覧する権限がありません"),
    ).toBeInTheDocument();
  });
});
