import type { ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  onLoadSuccess?: (info: unknown) => void;
};

const mockDocument = vi.fn((props: MockDocumentProps) => (
  <div data-testid="mock-document">{props.children}</div>
));

type MockPageProps = {
  pageNumber: number;
  width?: number;
  renderTextLayer?: boolean;
  renderAnnotationLayer?: boolean;
};

const mockPage = vi.fn((props: MockPageProps) => (
  <div data-testid={`mock-page-${props.pageNumber}`} />
));

vi.mock("react-pdf", () => {
  const workerOptions = { workerSrc: "" };

  return {
    pdfjs: {
      version: "4.8.69",
      GlobalWorkerOptions: workerOptions,
    },
    Document: (props: MockDocumentProps) => mockDocument(props),
    Page: (props: MockPageProps) => mockPage(props),
  };
});

function createMockPdfDocument(pageTexts: string[]) {
  return {
    numPages: pageTexts.length,
    getPage: vi.fn(async (pageNumber: number) => ({
      getTextContent: vi.fn(async () => ({
        items: [{ str: pageTexts[pageNumber - 1] ?? "" }],
      })),
    })),
  };
}

describe("PdfViewer", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    class MockResizeObserver {
      observe() {}
      disconnect() {}
    }
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("passes multilingual font options and text layer flags to react-pdf", () => {
    render(<PdfViewer fileUrl="https://example.com/paper.pdf" />);

    expect(mockDocument).toHaveBeenCalled();
    const [props] = mockDocument.mock.calls[0] as [MockDocumentProps];

    expect(props.file).toBe("https://example.com/paper.pdf");
    expect(props.options).toMatchObject({
      cMapPacked: true,
      cMapUrl: expect.stringContaining("/cmaps/"),
      standardFontDataUrl: expect.stringContaining("/standard_fonts/"),
    });

    const [pageProps] = mockPage.mock.calls[0] as [MockPageProps];
    expect(pageProps.pageNumber).toBe(1);
    expect(pageProps.renderTextLayer).toBe(true);
    expect(pageProps.renderAnnotationLayer).toBe(true);
  });

  it("defaults to continuous mode on mobile and virtualizes distant pages", async () => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("max-width"),
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );

    render(<PdfViewer fileUrl="https://example.com/mobile.pdf" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ページ送り" }),
      ).toBeInTheDocument();
    });

    const [documentProps] = mockDocument.mock.calls.at(-1) as [MockDocumentProps];
    mockPage.mockClear();
    await act(async () => {
      documentProps.onLoadSuccess?.(
        createMockPdfDocument(["p1", "p2", "p3", "p4"]),
      );
    });

    await waitFor(() => {
      const renderedPages = mockPage.mock.calls.map(
        ([props]) => props.pageNumber,
      );
      expect(renderedPages).toEqual(expect.arrayContaining([1, 2, 3]));
      expect(renderedPages).not.toContain(4);
    });
  });

  it("supports custom search navigation across pages", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);
    const [documentProps] = mockDocument.mock.calls.at(-1) as [MockDocumentProps];

    await act(async () => {
      documentProps.onLoadSuccess?.(
        createMockPdfDocument(["alpha", "beta target", "gamma target"]),
      );
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "PDF内検索" }), {
      target: { value: "target" },
    });

    await waitFor(() => {
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "次の一致" }));

    await waitFor(() => {
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
      const renderedPages = mockPage.mock.calls.map(
        ([props]) => props.pageNumber,
      );
      expect(renderedPages).toContain(3);
    });
  });

  it("syncs pinch zoom with zoom controls on touch devices", async () => {
    render(<PdfViewer fileUrl="https://example.com/pinch.pdf" />);
    const surface = screen.getByTestId("pdf-viewer-surface");
    const zoomSelect = screen.getByLabelText("PDF zoom") as HTMLSelectElement;

    fireEvent.touchStart(surface, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
    });
    fireEvent.touchMove(surface, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 180, clientY: 0 },
      ],
    });
    fireEvent.touchEnd(surface, { touches: [] });

    expect(zoomSelect.value).toBe("1.75");

    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(zoomSelect.value).toBe("2");
  });
});
