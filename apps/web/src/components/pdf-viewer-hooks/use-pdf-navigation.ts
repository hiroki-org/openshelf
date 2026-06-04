import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewMode } from "./types";

const CONTINUOUS_BUFFER = 2;

type UsePdfNavigationProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  numPages: number;
};

export function usePdfNavigation({
  containerRef,
  numPages,
}: UsePdfNavigationProps) {
  const pageNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const isProgrammaticNavRef = useRef(false);
  const prevViewModeRef = useRef<ViewMode>("paged");

  const [pageNumber, setPageNumber] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("paged");
  const [visiblePage, setVisiblePage] = useState(1);

  const activePage = viewMode === "continuous" ? visiblePage : pageNumber;
  const canPrev = activePage > 1;
  const canNext = numPages > 0 && activePage < numPages;

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

  const scrollToPage = useCallback(
    (targetPage: number, behavior: ScrollBehavior = "smooth") => {
      const node = pageNodesRef.current.get(targetPage);
      if (!node) return;
      node.scrollIntoView({ behavior, block: "start" });
    },
    [],
  );

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

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    if (window.matchMedia("(max-width: 768px), (pointer: coarse)").matches) {
      setViewMode("continuous");
    }
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
  }, [numPages, viewMode, renderRange.start, renderRange.end, containerRef]);

  const toggleViewMode = useCallback(() => {
    setViewMode((mode) => (mode === "paged" ? "continuous" : "paged"));
  }, []);

  return {
    pageNumber,
    viewMode,
    activePage,
    canPrev,
    canNext,
    renderRange,
    setPageNumber,
    setViewMode,
    setVisiblePage,
    goToPage,
    setPageNode,
    toggleViewMode,
  };
}
