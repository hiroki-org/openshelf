"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

type PdfViewerProps = {
  fileUrl: string;
  onDownloadFallback?: () => void;
};

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
type ZoomPreset = (typeof ZOOM_PRESETS)[number];

type PdfToolbarProps = {
  pageNumber: number;
  numPages: number;
  zoom: ZoomPreset;
  canPrev: boolean;
  canNext: boolean;
  canZoomOut: boolean;
  canZoomIn: boolean;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  zoomOut: () => void;
  zoomIn: () => void;
  changeZoom: (zoom: ZoomPreset) => void;
  toggleFullScreen: () => Promise<void>;
};

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

function usePdfViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState<ZoomPreset>(1);
  const [loadingError, setLoadingError] = useState(false);

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

  const pageWidth = useMemo(() => {
    if (containerWidth <= 0) return undefined;
    return Math.max(280, Math.floor(containerWidth * zoom));
  }, [containerWidth, zoom]);

  const canPrev = pageNumber > 1;
  const canNext = numPages > 0 && pageNumber < numPages;
  const canZoomOut = zoom > ZOOM_PRESETS[0];
  const canZoomIn = zoom < ZOOM_PRESETS[ZOOM_PRESETS.length - 1];

  const onDocumentLoadSuccess = useCallback((info: { numPages: number }) => {
    setNumPages(info.numPages);
    setPageNumber(1);
    setLoadingError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoadingError(true);
  }, []);

  const goToPrevPage = useCallback(() => {
    setPageNumber((p) => Math.max(1, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((p) => Math.min(numPages, p + 1));
  }, [numPages]);

  const zoomOut = useCallback(() => {
    setZoom((currentZoom) => {
      const idx = ZOOM_PRESETS.indexOf(currentZoom);
      if (idx <= 0) return currentZoom;
      return ZOOM_PRESETS[idx - 1];
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((currentZoom) => {
      const idx = ZOOM_PRESETS.indexOf(currentZoom);
      if (idx >= ZOOM_PRESETS.length - 1) return currentZoom;
      return ZOOM_PRESETS[idx + 1];
    });
  }, []);

  const changeZoom = useCallback((nextZoom: ZoomPreset) => {
    setZoom(nextZoom);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;

    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
        return;
      }

      await document.exitFullscreen();
    } catch {
      // Ignore fullscreen rejections caused by browser/user policy.
    }
  }, []);

  return {
    containerRef,
    numPages,
    pageNumber,
    zoom,
    loadingError,
    pageWidth,
    canPrev,
    canNext,
    canZoomOut,
    canZoomIn,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    goToPrevPage,
    goToNextPage,
    zoomOut,
    zoomIn,
    changeZoom,
    toggleFullScreen,
  };
}

function PdfToolbar({
  pageNumber,
  numPages,
  zoom,
  canPrev,
  canNext,
  canZoomOut,
  canZoomIn,
  goToPrevPage,
  goToNextPage,
  zoomOut,
  zoomIn,
  changeZoom,
  toggleFullScreen,
}: PdfToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goToPrevPage}
          disabled={!canPrev}
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
        >
          前へ
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {pageNumber} / {numPages || "-"}
        </span>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={!canNext}
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
        >
          次へ
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
        >
          -
        </button>

        <select
          aria-label="PDF zoom"
          value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value) as ZoomPreset)}
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
          onClick={zoomIn}
          disabled={!canZoomIn}
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
      </div>
    </div>
  );
}

export function PdfViewer({ fileUrl, onDownloadFallback }: PdfViewerProps) {
  const {
    containerRef,
    numPages,
    pageNumber,
    zoom,
    loadingError,
    pageWidth,
    canPrev,
    canNext,
    canZoomOut,
    canZoomIn,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    goToPrevPage,
    goToNextPage,
    zoomOut,
    zoomIn,
    changeZoom,
    toggleFullScreen,
  } = usePdfViewer();

  return (
    <div
      data-testid="pdf-viewer"
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <PdfToolbar
        pageNumber={pageNumber}
        numPages={numPages}
        zoom={zoom}
        canPrev={canPrev}
        canNext={canNext}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        goToPrevPage={goToPrevPage}
        goToNextPage={goToNextPage}
        zoomOut={zoomOut}
        zoomIn={zoomIn}
        changeZoom={changeZoom}
        toggleFullScreen={toggleFullScreen}
      />

      <div
        ref={containerRef}
        data-testid="pdf-viewer-surface"
        className="flex min-h-[420px] items-center justify-center overflow-auto rounded bg-gray-50 p-2 dark:bg-gray-950"
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
          {!loadingError && <Page pageNumber={pageNumber} width={pageWidth} />}
        </Document>
      </div>
    </div>
  );
}
