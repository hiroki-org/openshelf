"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { usePdfViewer, ZOOM_PRESETS, MIN_ZOOM, MAX_ZOOM } from "./pdf-viewer-hooks";

type PdfViewerProps = {
  fileUrl: string;
  onDownloadFallback?: () => void;
};

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export function PdfViewer({ fileUrl, onDownloadFallback }: PdfViewerProps) {
  const {
    containerRef,
    numPages,
    loadingError,
    pages,
    zoom,
    setZoom,
    isPinching,
    zoomIn,
    zoomOut,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    pageWidth,
    placeholderHeight,
    pageNumber,
    viewMode,
    activePage,
    canPrev,
    canNext,
    renderRange,
    goToPage,
    setPageNode,
    toggleViewMode,
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeMatchIndex,
    activeMatchPage,
    moveMatchCursor,
    textRenderer,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    toggleFullScreen,
  } = usePdfViewer();

  const searchMatchSet = new Set(searchMatches);

  const renderPage = (targetPage: number) => (
    <Page
      pageNumber={targetPage}
      width={pageWidth}
      renderTextLayer
      renderAnnotationLayer
      // react-pdf の TextLayer ハイライトは HTML 文字列を返す customTextRenderer が前提
      customTextRenderer={textRenderer}
    />
  );

  return (
    <div
      data-testid="pdf-viewer"
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(activePage - 1)}
            disabled={!canPrev}
            title={!canPrev ? "最初のページです" : undefined}
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
            title={!canNext ? "最後のページです" : undefined}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            次へ
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="ズームアウト"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title={zoom <= MIN_ZOOM ? "これ以上縮小できません" : undefined}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            -
          </button>

          <select
            aria-label="PDF zoom"
            value={zoom}
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
            aria-label="ズームイン"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title={zoom >= MAX_ZOOM ? "これ以上拡大できません" : undefined}
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
            onClick={toggleViewMode}
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
          title={
            searchMatches.length === 0 ? "検索結果がありません" : undefined
          }
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
        >
          前の一致
        </button>
        <button
          type="button"
          disabled={searchMatches.length === 0}
          onClick={() => moveMatchCursor(1)}
          title={
            searchMatches.length === 0 ? "検索結果がありません" : undefined
          }
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
                    targetPage >= renderRange.start &&
                    targetPage <= renderRange.end;
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
                <div
                  data-page-number={pageNumber}
                  className={`w-full rounded ${
                    activeMatchPage === pageNumber
                      ? "ring-2 ring-blue-500"
                      : searchMatchSet.has(pageNumber)
                        ? "ring-1 ring-blue-300"
                        : ""
                  }`}
                >
                  {renderPage(pageNumber)}
                </div>
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}
