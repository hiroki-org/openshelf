"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

type PdfViewerProps = {
  fileUrl: string;
  onDownloadFallback?: () => void;
};

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export function PdfViewer({ fileUrl, onDownloadFallback }: PdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState<(typeof ZOOM_PRESETS)[number]>(1);
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

  const onDocumentLoadSuccess = useCallback((info: { numPages: number }) => {
    setNumPages(info.numPages);
    setPageNumber(1);
    setLoadingError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoadingError(true);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    const node = viewerRef.current;
    if (!node) return;

    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
        return;
      }

      await document.exitFullscreen();
    } catch {
      // Ignore unsupported fullscreen API errors.
    }
  }, []);

  return (
    <div
      ref={viewerRef}
      data-testid="pdf-viewer"
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
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
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
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
              const idx = ZOOM_PRESETS.indexOf(zoom);
              if (idx > 0) setZoom(ZOOM_PRESETS[idx - 1]);
            }}
            disabled={zoom === ZOOM_PRESETS[0]}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            -
          </button>

          <select
            aria-label="PDF zoom"
            value={zoom}
            onChange={(e) =>
              setZoom(Number(e.target.value) as (typeof ZOOM_PRESETS)[number])
            }
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
              const idx = ZOOM_PRESETS.indexOf(zoom);
              if (idx < ZOOM_PRESETS.length - 1) setZoom(ZOOM_PRESETS[idx + 1]);
            }}
            disabled={zoom === ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
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
