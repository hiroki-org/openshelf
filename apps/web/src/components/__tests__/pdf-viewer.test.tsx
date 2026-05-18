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
  customTextRenderer?: (item: { str: string }) => string;
};

type MockObserverEntry = {
  target: Element;
  isIntersecting?: boolean;
  intersectionRatio?: number;
};

type MockIntersectionCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

const mockPage = vi.fn((props: MockPageProps) => (
  <div data-testid={`mock-page-${props.pageNumber}`} />
));

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  private readonly callback: MockIntersectionCallback;

  constructor(callback: MockIntersectionCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.add(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
  }

  disconnect() {
    this.observed.clear();
  }

  takeRecords() {
    return [];
  }

  triggerIntersect(entries: MockObserverEntry[]) {
    const normalizedEntries = entries.map(
      ({ target, isIntersecting = true, intersectionRatio = 1 }) =>
        ({
          target,
          isIntersecting,
          intersectionRatio,
          time: 0,
          rootBounds: null,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
        }) as IntersectionObserverEntry,
    );

    this.callback(normalizedEntries, this as unknown as IntersectionObserver);
  }
}

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
    MockIntersectionObserver.instances = [];

    class MockResizeObserver {
      observe() {}
      disconnect() {}
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

    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];
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

    const currentObserver =
      MockIntersectionObserver.instances[
        MockIntersectionObserver.instances.length - 1
      ];
    const page3Node = document.querySelector('[data-page-number="3"]');
    expect(currentObserver).toBeDefined();
    expect(page3Node).toBeTruthy();

    act(() => {
      currentObserver?.triggerIntersect([
        { target: page3Node as Element, intersectionRatio: 1 },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText("3 / 4")).toBeInTheDocument();
    });

    await waitFor(() => {
      const renderedPages = mockPage.mock.calls.map(
        ([props]) => props.pageNumber,
      );
      expect(renderedPages).toContain(4);
    });

    const refreshedObserver =
      MockIntersectionObserver.instances[
        MockIntersectionObserver.instances.length - 1
      ];
    const page4Node = document.querySelector('[data-page-number="4"]');
    expect(page4Node).toBeTruthy();
    expect(refreshedObserver?.observed.has(page4Node as Element)).toBe(true);
  });

  it("supports custom search navigation across pages", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

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

    fireEvent.click(screen.getByRole("button", { name: "前の一致" }));

    await waitFor(() => {
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "次の一致" }));
    await waitFor(() => {
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "連続スクロール" }));
    await waitFor(() => {
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
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

    // Invalid touchMove (not 2 touches)
    fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 0 }] });

    // Invalid touchMove (distance <= 0)
    fireEvent.touchMove(surface, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 0, clientY: 0 },
      ],
    });

    fireEvent.touchMove(surface, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 180, clientY: 0 },
      ],
    });

    // Invalid touchEnd (>= 2 touches)
    fireEvent.touchEnd(surface, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 180, clientY: 0 },
      ],
    });

    fireEvent.touchEnd(surface, { touches: [] });

    // Invalid touchEnd (no pinch state)
    fireEvent.touchEnd(surface, { touches: [] });

    expect(zoomSelect.value).toBe("1.75");

    fireEvent.click(screen.getByRole("button", { name: "ズームイン" }));
    expect(zoomSelect.value).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "ズームアウト" }));
    expect(zoomSelect.value).toBe("1.75");

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    fireEvent.click(screen.getByRole("button", { name: "前へ" }));
    fireEvent.click(screen.getByRole("button", { name: "連続スクロール" }));

    // Mock requestFullscreen
    const container = screen.getByTestId("pdf-viewer-surface");
    container.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "全画面" }));
    expect(container.requestFullscreen).toHaveBeenCalled();
  });

  it("handles text extraction errors gracefully during search", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<PdfViewer fileUrl="https://example.com/search-error.pdf" />);
      const [documentProps] = mockDocument.mock.calls[
        mockDocument.mock.calls.length - 1
      ] as [MockDocumentProps];

      await act(async () => {
        const mockDoc = createMockPdfDocument([
          "alpha",
          "beta target",
          "gamma target",
        ]);
        // Override page 2 to throw an error
        mockDoc.getPage = vi.fn(async (pageNumber: number) => {
          if (pageNumber === 2) {
            return {
              getTextContent: vi
                .fn()
                .mockRejectedValue(new Error("Extraction failed")),
            };
          }
          return {
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str:
                    ["alpha", "beta target", "gamma target"][pageNumber - 1] ??
                    "",
                },
              ],
            })),
          };
        });
        documentProps.onLoadSuccess?.(mockDoc);
      });

      fireEvent.change(screen.getByRole("searchbox", { name: "PDF内検索" }), {
        target: { value: "target" },
      });

      await waitFor(() => {
        // Should still find the match on page 3 despite page 2 failing
        expect(screen.getByText("1 / 1")).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to extract text for page 2:",
          expect.any(String),
        );
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("handles text extraction errors gracefully during search when error is not an Error instance", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <PdfViewer fileUrl="https://example.com/search-error-string.pdf" />,
      );
      const [documentProps] = mockDocument.mock.calls[
        mockDocument.mock.calls.length - 1
      ] as [MockDocumentProps];

      await act(async () => {
        const mockDoc = createMockPdfDocument([
          "alpha",
          "beta target",
          "gamma target",
        ]);
        mockDoc.getPage = vi.fn(async (pageNumber: number) => {
          if (pageNumber === 2) {
            return {
              getTextContent: vi.fn().mockRejectedValue("String error"),
            };
          }
          return {
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str:
                    ["alpha", "beta target", "gamma target"][pageNumber - 1] ??
                    "",
                },
              ],
            })),
          };
        });
        documentProps.onLoadSuccess?.(mockDoc);
      });

      fireEvent.change(screen.getByRole("searchbox", { name: "PDF内検索" }), {
        target: { value: "target" },
      });

      await waitFor(() => {
        expect(screen.getByText("1 / 1")).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to extract text for page 2:",
          "String error",
        );
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("highlights search text using customTextRenderer", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);

    const searchBox = screen.getAllByRole("searchbox", {
      name: "PDF内検索",
    })[0];

    fireEvent.change(searchBox, {
      target: { value: "test.*" },
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const pageCalls = mockPage.mock.calls;
    const lastCallProps = pageCalls[pageCalls.length - 1]?.[0];

    expect(lastCallProps).toBeDefined();
    expect(lastCallProps.customTextRenderer).toBeDefined();

    const renderer = lastCallProps.customTextRenderer!;
    const res = renderer({ str: "this is a test.* text" });
    expect(res).toContain('<mark class="highlight">test.*</mark>');
    expect(res).toContain("this is a ");

    const resEmpty = renderer({ str: "no match" });
    expect(resEmpty).toBe("no match");
  });

  it("escapes HTML when rendering highlighted search text", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);

    const searchBox = screen.getAllByRole("searchbox", {
      name: "PDF内検索",
    })[0];

    fireEvent.change(searchBox, {
      target: { value: "test" },
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const pageCalls = mockPage.mock.calls;
    const lastCallProps = pageCalls[pageCalls.length - 1]?.[0];
    const renderer = lastCallProps.customTextRenderer!;
    const res = renderer({ str: `<b>test</b> & "test" 'test'` });

    expect(res).toContain("&lt;b&gt;");
    expect(res).toContain('<mark class="highlight">test</mark>');
    expect(res).toContain("&lt;/b&gt;");
    expect(res).toContain("&amp;");
    expect(res).toContain("&quot;");
    expect(res).toContain("&#39;");
  });

  it("does not highlight search text when query is empty", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);

    const searchBox = screen.getAllByRole("searchbox", {
      name: "PDF内検索",
    })[0];

    fireEvent.change(searchBox, {
      target: { value: "test" },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    fireEvent.change(searchBox, {
      target: { value: "" },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const pageCalls = mockPage.mock.calls;
    const lastCallProps = pageCalls[pageCalls.length - 1]?.[0];

    expect(lastCallProps).toBeDefined();
    expect(lastCallProps.customTextRenderer).toBeDefined();

    const renderer = lastCallProps.customTextRenderer!;
    const res = renderer({ str: "this is a text" });
    expect(res).toBe("this is a text");
  });

  it("shows active match border in paged mode", async () => {
    render(<PdfViewer fileUrl="https://example.com/search.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      documentProps.onLoadSuccess?.(createMockPdfDocument(["alpha target"]));
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      {
        target: { value: "target" },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 1")).toBeInTheDocument();
    });

    await waitFor(() => {
      const currentPageWrapper = document.querySelector(
        '[data-page-number="1"]',
      );
      expect(currentPageWrapper).toHaveClass("ring-2", "ring-blue-500");
    });
  });
});
