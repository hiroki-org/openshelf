import type { ReactNode } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "../pdf-viewer";

type DocumentOptions = {
  cMapUrl?: string;
  cMapPacked?: boolean;
  standardFontDataUrl?: string;
};

type MockDocumentProps = {
  children?: ReactNode;
  file?: string;
  options?: DocumentOptions;
  onLoadSuccess?: (info: { numPages: number }) => void;
  onLoadError?: (error: Error) => void;
  loading?: ReactNode;
  error?: ReactNode;
};

const mockDocument = vi.fn((props: MockDocumentProps) => (
  <div data-testid="mock-document">
    <button
      data-testid="mock-load-success"
      onClick={() => props.onLoadSuccess?.({ numPages: 5 })}
    >Load Success</button>
    <button
      data-testid="mock-load-error"
      onClick={() => props.onLoadError?.(new Error("Test error"))}
    >Load Error</button>
    <div data-testid="error-state">{props.error}</div>
    {props.children}
  </div>
));

const mockPage = vi.fn((props: any) => <div data-testid="mock-page" data-page={props.pageNumber} data-width={props.width} />);

vi.mock("react-pdf", () => {
  const workerOptions = { workerSrc: "" };

  return {
    pdfjs: {
      version: "4.8.69",
      GlobalWorkerOptions: workerOptions,
    },
    Document: (props: MockDocumentProps) => mockDocument(props),
    Page: (props: any) => mockPage(props),
  };
});

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    class MockResizeObserver {
      observe() {}
      disconnect() {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });

    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("passes multilingual font options to react-pdf Document", () => {
    const { container } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    expect(mockDocument).toHaveBeenCalledTimes(1);
    const [props] = mockDocument.mock.calls[0] as [MockDocumentProps];

    expect(props.file).toBe("https://example.com/paper.pdf");
    expect(props.options).toMatchObject({
      cMapPacked: true,
      cMapUrl: expect.stringContaining("/cmaps/"),
      standardFontDataUrl: expect.stringContaining("/standard_fonts/"),
    });
  });

  it("handles document load success and navigation", () => {
    const { getByTestId, getByText } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    // Trigger load success
    fireEvent.click(getByTestId("mock-load-success"));

    // Page text should be 1 / 5
    expect(getByText("1 / 5")).toBeDefined();

    const nextBtn = getByText("次へ");
    const prevBtn = getByText("前へ");

    // Go to next page
    fireEvent.click(nextBtn);
    expect(getByText("2 / 5")).toBeDefined();

    // Go to previous page
    fireEvent.click(prevBtn);
    expect(getByText("1 / 5")).toBeDefined();
  });

  it("handles zooming", () => {
    const { getByText, getByRole } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    const zoomOutBtn = getByText("-");
    const zoomInBtn = getByText("+");
    const select = getByRole("combobox");

    // Default is 100%
    expect((select as HTMLSelectElement).value).toBe("1");

    // Zoom out
    fireEvent.click(zoomOutBtn);
    expect((select as HTMLSelectElement).value).toBe("0.75");

    // Zoom in
    fireEvent.click(zoomInBtn);
    expect((select as HTMLSelectElement).value).toBe("1");

    // Change via select
    fireEvent.change(select, { target: { value: "1.5" } });
    expect((select as HTMLSelectElement).value).toBe("1.5");
  });

  it("handles fullscreen toggle", () => {
    const { getByText } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    const fullscreenBtn = getByText("全画面");

    // Enter fullscreen
    fireEvent.click(fullscreenBtn);
    expect(HTMLElement.prototype.requestFullscreen).toHaveBeenCalled();

    // Mock being in fullscreen
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: document.createElement("div"),
    });

    // Exit fullscreen
    fireEvent.click(fullscreenBtn);
    expect(document.exitFullscreen).toHaveBeenCalled();
  });

  it("handles document load error with fallback", () => {
    const onFallback = vi.fn();
    const { getByTestId, getByText } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" onDownloadFallback={onFallback} />);

    fireEvent.click(getByTestId("mock-load-error"));

    const downloadBtn = getByText("ダウンロードする");
    fireEvent.click(downloadBtn);

    expect(onFallback).toHaveBeenCalled();
  });

  it("handles document load error without fallback", () => {
    const { getByTestId, getByText } = render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);
    fireEvent.click(getByTestId("mock-load-error"));
    expect(getByText("ダウンロードする").closest("a")).toHaveAttribute("href", "https://example.com/paper.pdf");
  });
});
