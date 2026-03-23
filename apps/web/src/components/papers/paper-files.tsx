import React from 'react';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { ssr: false },
);
const PptxViewer = dynamic(
  () => import("@/components/pptx-viewer").then((mod) => mod.PptxViewer),
  { ssr: false },
);

export type PaperFile = {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  mimeType: string | null;
  downloadUrl: string;
};

export type PreviewResponse = {
  url: string;
  mimeType: string;
  filename: string;
};

type PaperFilesProps = {
  files: PaperFile[];
  pdfFile: PaperFile | null;
  pptxFile: PaperFile | null;
  imageFiles: PaperFile[];
  preview: PreviewResponse | null;
  previewLoading: boolean;
  previewError: boolean;
  imagePreviewUrls: Record<string, string>;
  failedImageIds: string[];
  handleDownload: (f: PaperFile) => Promise<void>;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "paper":
      return "📄";
    case "slides":
      return "🎞️";
    case "poster":
      return "🖼️";
    case "supplementary":
      return "📎";
    default:
      return "📄";
  }
};

export function PaperFiles({
  files,
  pdfFile,
  pptxFile,
  imageFiles,
  preview,
  previewLoading,
  previewError,
  imagePreviewUrls,
  failedImageIds,
  handleDownload,
}: PaperFilesProps) {
  if (files.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-500 mb-2">ファイル</h2>

      {pdfFile && (
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium">PDFプレビュー</h3>
          {previewLoading && (
            <div className="h-[420px] animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
          )}
          {!previewLoading && preview?.url && (
            <PdfViewer
              fileUrl={preview.url}
              onDownloadFallback={() => handleDownload(pdfFile)}
            />
          )}
          {!previewLoading && previewError && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <p>プレビューを読み込めません</p>
              <button
                type="button"
                className="underline"
                onClick={() => handleDownload(pdfFile)}
              >
                ダウンロードする
              </button>
            </div>
          )}
        </div>
      )}

      {imageFiles.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {imageFiles.map((img) => (
            <div
              key={img.id}
              className="rounded-md border border-gray-200 p-2 dark:border-gray-700"
            >
              {imagePreviewUrls[img.id] ? (
                <img
                  src={imagePreviewUrls[img.id]}
                  alt={img.filename}
                  className="h-auto w-full rounded"
                  loading="lazy"
                />
              ) : failedImageIds.includes(img.id) ? (
                <div className="flex h-[180px] items-center justify-center rounded bg-red-50 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                  画像の読み込みに失敗しました
                </div>
              ) : (
                <div className="h-[180px] animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              )}
            </div>
          ))}
        </div>
      )}

      {pptxFile && (
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-medium">PPTXプレビュー</h3>
          <PptxViewer
            fileUrl={pptxFile.downloadUrl}
            onDownloadFallback={() => handleDownload(pptxFile)}
          />
        </div>
      )}

      <ul className="space-y-2">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl" title={f.fileType}>
                {getFileIcon(f.fileType)}
              </span>
              <div className="flex flex-col">
                <span className="font-medium">{f.filename}</span>
                <span className="text-xs text-gray-400">
                  {formatSize(f.sizeBytes)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDownload(f)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 transition-colors"
            >
              ダウンロード
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
