import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PptxViewer } from "../pptx-viewer";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("PptxViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders extracted slide text and supports paging", async () => {
    const pptxPath = path.resolve(
      __dirname,
      "../../../../e2e/fixtures/test-slides.pptx",
    );
    const pptxBuffer = fs.readFileSync(pptxPath);

    mockApiFetch.mockResolvedValueOnce(
      new Response(pptxBuffer, {
        status: 200,
        headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
      }),
    );

    render(<PptxViewer fileUrl="/api/downloads/slides.pptx" />);

    await screen.findByText("Slide 1");
    expect(screen.getByText("OpenShelf PPTX Preview 1")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await screen.findByText("Slide 2");
    expect(screen.getByText("OpenShelf PPTX Preview 2")).toBeInTheDocument();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/downloads/slides.pptx");
  });

  it("shows fallback UI and calls download fallback on parse error", async () => {
    const onDownloadFallback = vi.fn();

    mockApiFetch.mockResolvedValueOnce(
      new Response("broken", { status: 500 }),
    );

    render(
      <PptxViewer
        fileUrl="/api/downloads/broken.pptx"
        onDownloadFallback={onDownloadFallback}
      />,
    );

    await screen.findByText("PPTXプレビューを読み込めません");
    fireEvent.click(screen.getByRole("button", { name: "ダウンロードする" }));
    await waitFor(() => {
      expect(onDownloadFallback).toHaveBeenCalledTimes(1);
    });
  });
});
