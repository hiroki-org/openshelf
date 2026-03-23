"use client";

import { useId, useRef, useState } from "react";

export const VALID_FILE_TYPES = [
  "paper",
  "slides",
  "poster",
  "supplementary",
] as const;

export type FileEntry = {
  id: string;
  file: File;
  fileType: (typeof VALID_FILE_TYPES)[number];
};

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
] as const;

type FileDropzoneProps = {
  files: FileEntry[];
  onAddFiles: (files: FileList | File[] | null) => void;
  onRemoveFile: (index: number) => void;
  onUpdateFileType: (index: number, newType: FileEntry["fileType"]) => void;
};

export function FileDropzone({
  files,
  onAddFiles,
  onRemoveFile,
  onUpdateFileType,
}: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
      ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
    );

    if (validFiles.length === 0) return;

    onAddFiles(validFiles);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
      <p
        id={`upload-files-label-${dropzoneId}`}
        className="mb-4 block text-sm font-semibold text-gray-900 dark:text-gray-100"
      >
        添付ファイル <span className="text-red-500">*</span>
      </p>
      <input
        ref={fileInputRef}
        aria-label="アップロードファイル"
        type="file"
        multiple
        accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg"
        onChange={(e) => { onAddFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        aria-describedby={`upload-files-label-${dropzoneId}`}
        className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 transition-all ${
          isDragging
            ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
            : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600 dark:hover:bg-gray-900"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-gray-700">
          <span className="text-2xl">+</span>
        </div>
        <span className="mt-4 block text-sm font-medium text-gray-900 dark:text-gray-100">
          ファイルを複数選択
        </span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          PDF, PPT, 画像 / 1ファイル最大50MB
        </span>
      </button>

      {files.length > 0 && (
        <ul className="mt-6 space-y-3">
          {files.map((entry, i) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {entry.file.name}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {(entry.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="ファイル種別"
                  value={entry.fileType}
                  onChange={(e) =>
                    onUpdateFileType(i, e.target.value as FileEntry["fileType"])
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-gray-900 focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-100"
                >
                  {VALID_FILE_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemoveFile(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <span>✕</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
