import { useCallback, useEffect, useRef, useState } from "react";
import type { PdfDocumentProxy } from "./types";
import { usePdfNavigation } from "./use-pdf-navigation";
import { usePdfSearch } from "./use-pdf-search";
import { usePdfZoom } from "./use-pdf-zoom";
import { usePdfDimensions } from "./use-pdf-dimensions";

export function usePdfViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocumentRef = useRef<PdfDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [loadingError, setLoadingError] = useState(false);

  const {
    zoom,
    setZoom,
    isPinching,
    zoomIn,
    zoomOut,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePdfZoom();

  const { pageWidth, placeholderHeight } = usePdfDimensions(containerRef, zoom);

  const {
    pageNumber,
    viewMode,
    activePage,
    canPrev,
    canNext,
    renderRange,
    goToPage,
    setPageNode,
    toggleViewMode,
    setPageNumber,
    setVisiblePage,
  } = usePdfNavigation({ containerRef, numPages });

  const {
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeMatchIndex,
    activeMatchPage,
    moveMatchCursor,
    textRenderer,
    clearSearchCache,
    resetSearchState,
  } = usePdfSearch({
    pdfDocumentRef,
    numPages,
    goToPage,
  });

  const onDocumentLoadSuccess = useCallback(
    (info: unknown) => {
      const pdfDocument = info as PdfDocumentProxy;
      pdfDocumentRef.current = pdfDocument;
      clearSearchCache();
      setNumPages(pdfDocument.numPages);
      setPageNumber(1);
      setVisiblePage(1);
      resetSearchState();
      setLoadingError(false);
    },
    [clearSearchCache, resetSearchState, setPageNumber, setVisiblePage],
  );

  const onDocumentLoadError = useCallback(() => {
    pdfDocumentRef.current = null;
    clearSearchCache();
    setLoadingError(true);
  }, [clearSearchCache]);

  const toggleFullScreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;

    if (!document.fullscreenElement) {
      await node.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  // Setup touch-action preventing default behavior on pinch
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleNativeTouchMove = (event: Event) => {
      const touchEvent = event as globalThis.TouchEvent;
      if (touchEvent.touches.length !== 2) return;
      // We only preventDefault if zooming in process
      if (isPinching) {
        touchEvent.preventDefault();
      }
    };

    node.addEventListener("touchmove", handleNativeTouchMove, {
      passive: false,
    });
    return () => {
      node.removeEventListener("touchmove", handleNativeTouchMove);
    };
  }, [isPinching]);

  const pages = Array.from({ length: numPages }, (_, index) => index + 1);

  return {
    containerRef,
    numPages,
    loadingError,
    pages,

    // zoom
    zoom,
    setZoom,
    isPinching,
    zoomIn,
    zoomOut,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,

    // dimensions
    pageWidth,
    placeholderHeight,

    // navigation
    pageNumber,
    viewMode,
    activePage,
    canPrev,
    canNext,
    renderRange,
    goToPage,
    setPageNode,
    toggleViewMode,

    // search
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeMatchIndex,
    activeMatchPage,
    moveMatchCursor,
    textRenderer,

    // callbacks
    onDocumentLoadSuccess,
    onDocumentLoadError,
    toggleFullScreen,
  };
}
