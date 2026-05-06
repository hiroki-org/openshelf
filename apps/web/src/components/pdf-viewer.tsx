"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";

type PdfViewerProps = {
  fileUrl: string;
  onDownloadFallback?: () => void;
};

type ViewMode = "paged" | "continuous";

type PdfTextContent = {
  items: unknown[];
};

type PdfPageProxy = {
  getTextContent: () => Promise<PdfTextContent>;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};

const ZOOM_PRESETS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
const MIN_ZOOM = ZOOM_PRESETS[0];
const MAX_ZOOM = ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
const CONTINUOUS_BUFFER = 2;
const PAGE_ASPECT_RATIO = 1.414;
const SEARCH_DEBOUNCE_MS = 350;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function snapZoom(value: number): (typeof ZOOM_PRESETS)[number] {
  const clamped = clampZoom(value);
  const nearest = ZOOM_PRESETS.reduce((previous, current) =>
    Math.abs(current - clamped) < Math.abs(previous - clamped)
      ? current
      : previous,
  );
  return nearest;
}

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export function PdfViewer({ fileUrl, onDownloadFallback }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const pdfDocumentRef = useRef<PdfDocumentProxy | null>(null);
  const searchTextCacheRef = useRef<Map<number, string>>(new Map());
  const isProgrammaticNavRef = useRef(false);
  const prevViewModeRef = useRef<ViewMode>("paged");

  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("paged");
  const [visiblePage, setVisiblePage] = useState(1);
  const [loadingError, setLoadingError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isPinching, setIsPinching] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    if (window.matchMedia("(max-width: 768px), (pointer: coarse)").matches) {
      setViewMode("continuous");
    }
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.floor(width));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleNativeTouchMove = (event: Event) => {
      const touchEvent = event as globalThis.TouchEvent;
      if (!pinchStateRef.current || touchEvent.touches.length !== 2) return;
      touchEvent.preventDefault();
    };

    node.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => {
      node.removeEventListener("touchmove", handleNativeTouchMove);
    };
  }, []);

  const pageWidth = useMemo(() => {
    if (containerWidth <= 0) return undefined;
    return Math.max(280, Math.floor(containerWidth * zoom));
  }, [containerWidth, zoom]);
  const placeholderHeight = Math.max(
    360,
    Math.floor((pageWidth ?? containerWidth ?? 420) * PAGE_ASPECT_RATIO),
  );

  const activePage = viewMode === "continuous" ? visiblePage : pageNumber;
  const canPrev = activePage > 1;
  const canNext = numPages > 0 && activePage < numPages;
  const searchMatchSet = useMemo(
    () => new Set(searchMatches),
    [searchMatches],
  );
  const pages = useMemo(
    () => Array.from({ length: numPages }, (_, index) => index + 1),
    [numPages],
  );
  const renderRange = useMemo(() => {
    if (viewMode !== "continuous" || numPages === 0) {
      return { start: 1, end: numPages };
    }
    return {
      start: Math.max(1, visiblePage - CONTINUOUS_BUFFER),
      end: Math.min(numPages, visiblePage + CONTINUOUS_BUFFER),
    };
  }, [numPages, viewMode, visiblePage]);

  const setPageNode = useCallback(
    (page: number) => (node: HTMLDivElement | null) => {
      if (node) {
        pageNodesRef.current.set(page, node);
      } else {
        pageNodesRef.current.delete(page);
      }
    },
    [],
  );

  const scrollToPage = useCallback((targetPage: number, behavior: ScrollBehavior = "smooth") => {
    const node = pageNodesRef.current.get(targetPage);
    if (!node) return;
    node.scrollIntoView({ behavior, block: "start" });
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      if (numPages <= 0) return;
      const boundedPage = Math.min(numPages, Math.max(1, targetPage));
      setPageNumber(boundedPage);
      if (viewMode === "continuous") {
        isProgrammaticNavRef.current = true;
        setVisiblePage(boundedPage);
      }
    },
    [numPages, viewMode],
  );

  const onDocumentLoadSuccess = useCallback((info: unknown) => {
    const pdfDocument = info as PdfDocumentProxy;
    pdfDocumentRef.current = pdfDocument;
    searchTextCacheRef.current.clear();
    setNumPages(pdfDocument.numPages);
    setPageNumber(1);
    setVisiblePage(1);
    setSearchMatches([]);
    setActiveMatchIndex(-1);
    setLoadingError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    pdfDocumentRef.current = null;
    searchTextCacheRef.current.clear();
    setLoadingError(true);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      await node.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  useEffect(() => {
    const enteringContinuous =
      viewMode === "continuous" && prevViewModeRef.current !== "continuous";
    const shouldScroll =
      viewMode === "continuous" &&
      (enteringContinuous || isProgrammaticNavRef.current);

    if (shouldScroll) {
      requestAnimationFrame(() => {
        scrollToPage(pageNumber, "auto");
      });
    }

    isProgrammaticNavRef.current = false;
    prevViewModeRef.current = viewMode;
  }, [viewMode, pageNumber, scrollToPage]);

  useEffect(() => {
    if (viewMode !== "continuous" || numPages === 0) return;
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const primaryEntry = visibleEntries[0];
        if (!primaryEntry) return;
        const page = Number(
          (primaryEntry.target as HTMLElement).dataset.pageNumber ?? "",
        );
        if (!Number.isFinite(page)) return;
        setVisiblePage(page);
        setPageNumber(page);
      },
      {
        root,
        threshold: [0.2, 0.4, 0.6, 0.8],
      },
    );

    pageNodesRef.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [numPages, viewMode, pageWidth, renderRange.start, renderRange.end]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const query = debouncedSearchQuery.toLowerCase();
    const doc = pdfDocumentRef.current;
    if (!doc || !query) {
      setSearchMatches([]);
      setActiveMatchIndex(-1);
      return;
    }

    let cancelled = false;

    void (async () => {
      const matches: number[] = [];
      for (let page = 1; page <= doc.numPages; page += 1) {
        try {
          let pageText = searchTextCacheRef.current.get(page);
          if (pageText === undefined) {
            const pdfPage = await doc.getPage(page);
            const textContent = await pdfPage.getTextContent();
            pageText = textContent.items
              .map((item) => {
                if (
                  item &&
                  typeof item === "object" &&
                  "str" in item &&
                  typeof (item as { str?: unknown }).str === "string"
                ) {
                  return ((item as { str: string }).str).toLowerCase();
                }
                return "";
              })
              .join(" ");
            searchTextCacheRef.current.set(page, pageText);
          }
          if (pageText.includes(query)) {
            matches.push(page);
          }
        } catch (error) {
          const message = error instanceof Error ? String(error) : String(error);
          console.warn(`Failed to extract text for page ${page}:`, message);
        }
      }
      if (cancelled) return;
      setSearchMatches(matches);
      if (matches.length === 0) {
        setActiveMatchIndex(-1);
        return;
      }
      setActiveMatchIndex(0);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, numPages]);

  const activeMatchPage =
    activeMatchIndex >= 0 ? searchMatches[activeMatchIndex] : undefined;
  const moveMatchCursor = useCallback(
    (direction: -1 | 1) => {
      if (searchMatches.length === 0) return;
      const current = activeMatchIndex >= 0 ? activeMatchIndex : 0;
      const next =
        (current + direction + searchMatches.length) % searchMatches.length;
      setActiveMatchIndex(next);
      goToPage(searchMatches[next]);
    },
    [activeMatchIndex, goToPage, searchMatches],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return;
      const first = event.touches[0];
      const second = event.touches[1];
      pinchStateRef.current = {
        startDistance: touchDistance(first, second),
        startZoom: zoom,
      };
      setIsPinching(true);
    },
    [zoom],
  );

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const state = pinchStateRef.current;
    if (!state || event.touches.length !== 2) return;
    event.preventDefault();
    const first = event.touches[0];
    const second = event.touches[1];
    const nextDistance = touchDistance(first, second);
    if (nextDistance <= 0 || state.startDistance <= 0) return;
    const nextZoom = state.startZoom * (nextDistance / state.startDistance);
    setZoom(clampZoom(nextZoom));
  }, []);

  const handleTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) return;
    if (!pinchStateRef.current) return;
    pinchStateRef.current = null;
    setZoom((current) => snapZoom(current));
    setIsPinching(false);
  }, []);

  const renderPage = (targetPage: number) => (
    <Page
      pageNumber={targetPage}
      width={pageWidth}
      renderTextLayer
      renderAnnotationLayer
    />
  );

  return (
    <div
      data-testid="pdf-viewer"
      data-url={fileUrl}
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={!canPrev}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            >
              前へ
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {activePage} / {numPages || "-"}
            </span>
            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={!canNext}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            >
            次へ
          </button>
        </div>

        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const currentIndex = ZOOM_PRESETS.indexOf(snapZoom(zoom));
                if (currentIndex > 0) setZoom(ZOOM_PRESETS[currentIndex - 1]);
              }}
              disabled={zoom <= MIN_ZOOM}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            -
          </button>

          <select
            aria-label="PDF zoom"
            value={snapZoom(zoom)}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
          >
            {ZOOM_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {Math.round(preset * 100)}%
              </option>
            ))}
          </select>

            <button
              type="button"
              onClick={() => {
                const currentIndex = ZOOM_PRESETS.indexOf(snapZoom(zoom));
                if (currentIndex < ZOOM_PRESETS.length - 1) {
                  setZoom(ZOOM_PRESETS[currentIndex + 1]);
                }
              }}
              disabled={zoom >= MAX_ZOOM}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            +
          </button>

            <button
              type="button"
              onClick={toggleFullScreen}
              className="rounded bg-gray-800 px-2 py-1 text-xs text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900"
            >
              全画面
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode((mode) =>
                  mode === "paged" ? "continuous" : "paged",
                )
              }
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
            >
              {viewMode === "paged" ? "連続スクロール" : "ページ送り"}
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="PDF内検索"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="検索語を入力"
            className="min-w-[180px] flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
          />
          <button
            type="button"
            disabled={searchMatches.length === 0}
            onClick={() => moveMatchCursor(-1)}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            前の一致
          </button>
          <button
            type="button"
            disabled={searchMatches.length === 0}
            onClick={() => moveMatchCursor(1)}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            次の一致
          </button>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="text-xs text-gray-500 dark:text-gray-300"
          >
            {searchQuery.trim().length === 0
              ? ""
              : searchMatches.length === 0
                ? "一致なし"
                : `${activeMatchIndex + 1} / ${searchMatches.length}`}
          </span>
        </div>

      <div
        ref={containerRef}
        data-testid="pdf-viewer-surface"
        className={`min-h-[420px] overflow-auto rounded bg-gray-50 p-2 dark:bg-gray-950 ${isPinching ? "touch-none" : "touch-pan-y"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Document
          key={fileUrl}
          file={fileUrl}
          options={options}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="h-[360px] w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          }
          error={
            <div className="text-center text-sm text-red-600">
              <p>プレビューを読み込めません</p>
              {onDownloadFallback ? (
                <button
                  type="button"
                  className="underline"
                  onClick={onDownloadFallback}
                >
                  ダウンロードする
                </button>
              ) : (
                <a
                  className="underline"
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ダウンロードする
                </a>
              )}
            </div>
          }
        >
          {!loadingError &&
            (viewMode === "continuous" ? (
              <div className="flex flex-col items-center gap-4 py-1">
                {pages.map((targetPage) => {
                  const isVisibleByBuffer =
                    targetPage >= renderRange.start && targetPage <= renderRange.end;
                  const isSearchMatch = searchMatchSet.has(targetPage);
                  const isActiveSearchMatch = activeMatchPage === targetPage;
                  const shouldRender = isVisibleByBuffer || isActiveSearchMatch;

                  return (
                    <div
                      key={targetPage}
                      ref={setPageNode(targetPage)}
                      data-page-number={targetPage}
                      className={`w-full rounded ${
                        isActiveSearchMatch
                          ? "ring-2 ring-blue-500"
                          : isSearchMatch
                            ? "ring-1 ring-blue-300"
                            : ""
                      }`}
                    >
                      {shouldRender ? (
                        renderPage(targetPage)
                      ) : (
                        <div
                          aria-hidden="true"
                          className="mx-auto rounded border border-dashed border-gray-300 bg-gray-100/60 dark:border-gray-700 dark:bg-gray-900/40"
                          style={{
                            width: pageWidth ?? "100%",
                            height: placeholderHeight,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                {renderPage(pageNumber)}
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}
