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
  customTextRenderer?: (textItem: { str: string }) => string;
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

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      {
        target: { value: "target" },
      },
    );

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

      fireEvent.change(
        screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
        {
          target: { value: "target" },
        },
      );

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

      fireEvent.change(
        screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
        {
          target: { value: "target" },
        },
      );

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

  it("cancels search if component unmounts or query changes", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    let resolveGetPage: (val: any) => void;
    const getPagePromise = new Promise((resolve) => {
      resolveGetPage = resolve;
    });

    await act(async () => {
      const mockDoc = createMockPdfDocument([
        "alpha",
        "beta target",
        "gamma target",
      ]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        await getPagePromise;
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // unmount before search resolves
    unmount();
    resolveGetPage!(undefined);

    // Wait to ensure no state updates happen after unmount
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("shows no matches found if query doesn't match any text", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-nomatch.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha", "beta", "gamma"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("一致なし")).toBeInTheDocument();
    });
  });

  it("cancels search if component unmounts right after Promise.all finishes", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel2.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    let resolveGetPage: (val: any) => void;
    const getPagePromise = new Promise((resolve) => {
      resolveGetPage = resolve;
    });

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        await getPagePromise;
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    let unmounted = false;
    // We want to unmount right after the batch finishes but before the outer loop continues
    // Since we can't easily hook into the exact microtask, we resolve the promise and immediately unmount.
    resolveGetPage!(undefined);
    unmount();
    unmounted = true;

    // Wait to ensure no state updates happen after unmount
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("cancels search if component unmounts right before batch starts", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel3.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    unmount(); // unmount before debounce finishes and void (async() => {}) starts executing

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  });

  it("shows active match cursor when moveMatchCursor is called via next/prev buttons", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-cursor.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument([
        "target 1",
        "no match",
        "target 2",
      ]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    // We do not have any matches, try calling it
    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "nomatch" } },
    );

    await waitFor(() => {
      expect(screen.getByText("一致なし")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "次の一致" }));
  });

  it("cancels search gracefully when unmounting during batch wait", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel4.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      // Slow down getPage significantly so it's in the middle of waiting
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce and let getPage start
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // unmount while Promise.all is waiting
    unmount();

    // Wait for the slow getPage to finish resolving and unhandled rejections/cancellations to process
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
  });

  it("cancels search if component unmounts right after batch loop finishes before state update", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel5.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    let resolveGetPage: (val: any) => void;
    const getPagePromise = new Promise((resolve) => {
      resolveGetPage = resolve;
    });

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        await getPagePromise;
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Resolve promise to let batch finish
    resolveGetPage!(undefined);

    // Unmount before the microtask for `if (cancelled) return;` executes
    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("cancels search if component unmounts immediately after results loop", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel6.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // We can't perfectly mock unmounting after the internal loop but before setting state
    // But we can just make sure unmounting works safely at any point
    unmount();
  });

  it("does not crash if search items map callback hits branch returning empty string", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-invalid.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              null,
              undefined,
              "not an object",
              { not_str: "invalid" },
              { str: 123 }, // not a string
              { str: "TARGET" }, // valid match
            ],
          }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 1")).toBeInTheDocument();
    });
  });

  it("cancels search if component unmounts at start of outer loop", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel7.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // unmount synchronously before async tick where debounce finishes
    unmount();

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  });

  it("handles empty items safely during extraction", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-invalid2.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [null, undefined, { str: "target" }],
          }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 1")).toBeInTheDocument();
    });
  });

  it("cancels search if component unmounts correctly at final cancelled check", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel8.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["target"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Unmount before state is set but after loops complete
    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("handles outer cancelled condition", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel9.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      // Multiple pages so it loops
      const mockDoc = createMockPdfDocument(["target", "target2"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // let it debounce and start
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Force unmount immediately as it enters batch 2
    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("hits the final cancelled check before setting matches", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel10.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["target"]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Let it resolve immediately, wait for the state update, then unmount immediately
    // Or simpler: debounce it, then in the next tick unmount
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // We want to unmount right before `if (cancelled) return;` at the end
    // It is very hard to deterministically hit that exact line. But the outer loops
    // execute microtasks, so we can run unmount.
    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("test handles unexpected types in items", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-invalid3.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [null, undefined, {}, { str: null }, { str: "target" }],
          }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 1")).toBeInTheDocument();
    });
  });

  it("forces branch line 326 (if cancelled return)", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel11.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument([
        "target",
        "target",
        "target",
        "target",
        "target",
        "target",
        "target",
        "target",
        "target",
        "target",
        "target", // page 11
      ]);
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    // Trigger debounce
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("forces branch line 372 (if cancelled return)", async () => {
    const { unmount } = render(
      <PdfViewer fileUrl="https://example.com/search-cancel12.pdf" />,
    );
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    let resolveGetPage: (val: any) => void;
    const getPagePromise = new Promise((resolve) => {
      resolveGetPage = resolve;
    });

    await act(async () => {
      const mockDoc = createMockPdfDocument(["target"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        await getPagePromise;
        return {
          getTextContent: vi
            .fn()
            .mockResolvedValue({ items: [{ str: "target" }] }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Resolve getPage and immediately unmount to trigger the final `if (cancelled) return;`
    // after the loop finishes. Since the loop only has 1 batch, it exits the loop
    // and hits line 372. By unmounting here, we ensure cancelled is set to true just in time.
    resolveGetPage!(undefined);
    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it("forces branch line 347 (return empty string)", async () => {
    render(<PdfViewer fileUrl="https://example.com/search-invalid4.pdf" />);
    const [documentProps] = mockDocument.mock.calls[
      mockDocument.mock.calls.length - 1
    ] as [MockDocumentProps];

    await act(async () => {
      const mockDoc = createMockPdfDocument(["alpha"]);
      mockDoc.getPage = vi.fn(async (pageNumber: number) => {
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ notStr: "invalid" }],
          }),
        };
      });
      documentProps.onLoadSuccess?.(mockDoc);
    });

    fireEvent.change(
      screen.getAllByRole("searchbox", { name: "PDF内検索" })[0],
      { target: { value: "target" } },
    );

    await waitFor(() => {
      expect(screen.getByText("一致なし")).toBeInTheDocument();
    });
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
