import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock pdfjs BEFORE importing the component
vi.mock("react-pdf", () => ({
  Document: vi.fn(({ children, options, file, onLoadSuccess, onLoadError, error }) => (
    <div data-testid="mock-document" data-file={file} data-options={JSON.stringify(options)}>
      {children}
      <button data-testid="load-success" onClick={() => onLoadSuccess({ numPages: 5 })} />
      <button data-testid="load-error" onClick={() => onLoadError(new Error('test'))} />
      <div data-testid="error-state">{error}</div>
    </div>
  )),
  Page: vi.fn(({ pageNumber, width }) => (
    <div data-testid="mock-page" data-page-number={pageNumber} data-width={width} />
  )),
  pdfjs: {
    version: "3.11.174",
    GlobalWorkerOptions: {
      workerSrc: "",
    },
  },
}));

import { PdfViewer } from "../pdf-viewer";

// Mock ResizeObserver
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("PdfViewer", () => {
  const testPdfUrl = "https://example.com/test.pdf";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render with correct cMap configuration for Japanese fonts", () => {
    render(<PdfViewer fileUrl={testPdfUrl} />);

    // Since react-pdf might remount Document with new key, use getByTestId array length to be safe or [0]
    const documentElements = screen.getAllByTestId("mock-document");
    const documentElement = documentElements[documentElements.length - 1];

    // Parse the options passed to Document
    const optionsAttr = documentElement.getAttribute("data-options");
    expect(optionsAttr).toBeTruthy();

    const options = JSON.parse(optionsAttr!);

    // Verify cMapUrl is correctly set to unpkg cdn
    expect(options.cMapUrl).toBe(`https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`);
    // Verify cMapPacked is true
    expect(options.cMapPacked).toBe(true);
  });

  it("should display loading error and fallback on failure", () => {
    const fallbackFn = vi.fn();
    render(<PdfViewer fileUrl={testPdfUrl} onDownloadFallback={fallbackFn} />);

    // Multiple mock-documents might be rendered due to React.StrictMode or re-renders
    const loadErrorButtons = screen.getAllByTestId("load-error");

    // Trigger load error on the first one
    fireEvent.click(loadErrorButtons[0]);

    // Check if error message is shown in the mock error render
    expect(screen.getAllByText("プレビューを読み込めません").length).toBeGreaterThan(0);

    // Check if fallback button is shown
    const fallbackButtons = screen.getAllByRole("button", { name: "ダウンロードする" });
    expect(fallbackButtons.length).toBeGreaterThan(0);

    fireEvent.click(fallbackButtons[0]);
    expect(fallbackFn).toHaveBeenCalledOnce();
  });

  it("should handle navigation after successful load", () => {
    render(<PdfViewer fileUrl={testPdfUrl} />);

    // Multiple mock-documents might be rendered
    const loadSuccessButtons = screen.getAllByTestId("load-success");

    // Trigger load success with 5 pages
    fireEvent.click(loadSuccessButtons[0]);

    // Navigation buttons
    const prevBtns = screen.getAllByRole("button", { name: "前へ" });
    const nextBtns = screen.getAllByRole("button", { name: "次へ" });

    // Initial state: page 1/5
    expect(screen.getAllByText("1 / 5").length).toBeGreaterThan(0);
    expect(prevBtns[0]).toBeDisabled();
    expect(nextBtns[0]).toBeEnabled();

    // Go next
    fireEvent.click(nextBtns[0]);
    expect(screen.getAllByText("2 / 5").length).toBeGreaterThan(0);
    expect(prevBtns[0]).toBeEnabled();

    // Verify page component received correct page number
    const pageElements = screen.getAllByTestId("mock-page");
    const pageElement = pageElements[pageElements.length - 1];
    expect(pageElement.getAttribute("data-page-number")).toBe("2");
  });
});
