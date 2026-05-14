"use client";

import { useAuth } from "@/components/auth-provider";
import { TagAutocompleteInput } from "@/components/tag-autocomplete-input";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const VALID_FILE_TYPES = [
  "paper",
  "slides",
  "poster",
  "supplementary",
] as const;
const VISIBILITY_OPTIONS = [
  { value: "private", label: "非公開" },
  { value: "org_only", label: "組織内" },
  { value: "public", label: "公開" },
] as const;
const CATEGORY_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "thesis_bachelor", label: "学士論文" },
  { value: "thesis_master", label: "修士論文" },
  { value: "report", label: "レポート" },
  { value: "presentation", label: "プレゼンテーション" },
  { value: "other", label: "その他" },
] as const;
const VENUE_TYPE_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "conference", label: "学会" },
  { value: "journal", label: "ジャーナル" },
  { value: "workshop", label: "ワークショップ" },
  { value: "other", label: "その他" },
] as const;

type FileEntry = {
  file: File;
  fileType: (typeof VALID_FILE_TYPES)[number];
};

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [visibility, setVisibility] =
    useState<(typeof VISIBILITY_OPTIONS)[number]["value"]>("private");
  const [showViewCount, setShowViewCount] = useState(false);
  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const newEntries: FileEntry[] = Array.from(selected).map((f) => ({
      file: f,
      fileType: "paper",
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }
    if (files.length === 0) {
      setError("ファイルを1つ以上添付してください");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(
        "metadata",
        JSON.stringify({
          title: title.trim(),
          abstract: abstract.trim() || null,
          visibility,
          showViewCount,
          venue: venue.trim() || null,
          venueType: venueType || null,
          year: year ? Number(year) : null,
          category: category || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      );

      files.forEach((entry, i) => {
        formData.append(`files_${i}`, entry.file);
        formData.append(`file_types_${i}`, entry.fileType);
      });

      const res = await apiFetch("/api/papers", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/papers/${data.paper.id}`);
        return;
      }

      const data = await res.json();
      setError(data.error ?? "アップロードに失敗しました");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="mb-8 rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Upload
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
              論文アップロード
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              タイトルや公開範囲、関連ファイルをまとめて登録します。必要な情報から順に入力できるよう、
              セクションごとに整理しています。
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              添付ファイル
            </p>
            <p className="mt-1">{files.length} 件選択中</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          著者最終稿（Author Accepted Manuscript）をアップロードしてください。
          出版社版のアップロードは著作権上の問題がある場合があります。
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="paper-title"
            className="block text-sm font-medium mb-1"
          >
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            id="paper-title"
            type="text"
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-describedby="title-counter"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
          />
          <div
            id="title-counter"
            className="mt-1 flex justify-end text-xs text-gray-500 dark:text-gray-400"
          >
            {title.length}/300
          </div>
        </div>

        <div>
          <label
            htmlFor="paper-abstract"
            className="block text-sm font-medium mb-1"
          >
            概要
          </label>
          <textarea
            id="paper-abstract"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            maxLength={5000}
            aria-describedby="abstract-counter"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div
            id="abstract-counter"
            className="mt-1 flex justify-end text-xs text-gray-500 dark:text-gray-400"
          >
            {abstract.length}/5000
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="paper-visibility"
              className="block text-sm font-medium mb-1"
            >
              公開範囲
            </label>
            <select
              id="paper-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target
                    .value as (typeof VISIBILITY_OPTIONS)[number]["value"],
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="paper-year"
              className="block text-sm font-medium mb-1"
            >
              発表年
            </label>
            <input
              id="paper-year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <label
            htmlFor="paper-show-view-count"
            className="flex items-start gap-3"
          >
            <input
              id="paper-show-view-count"
              type="checkbox"
              checked={showViewCount}
              onChange={(e) => setShowViewCount(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                公開ページに閲覧数を表示する
              </span>
              <span className="block text-xs leading-5 text-gray-600 dark:text-gray-400">
                著者向けの閲覧統計は常に内部で記録されます。ここをオンにした場合のみ、詳細ページに総閲覧数を公開表示します。
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="paper-venue"
              className="block text-sm font-medium mb-1"
            >
              会場名
            </label>
            <input
              id="paper-venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label
              htmlFor="paper-venue-type"
              className="block text-sm font-medium mb-1"
            >
              会場種別
            </label>
            <select
              id="paper-venue-type"
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {VENUE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="paper-category"
            className="block text-sm font-medium mb-1"
          >
            カテゴリ
          </label>
          <select
            id="paper-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="paper-tags"
            className="block text-sm font-medium mb-1"
          >
            タグ（カンマ区切り）
          </label>
          <TagAutocompleteInput
            id="paper-tags"
            value={tags}
            onChange={setTags}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="例: NLP, LLM, attention"
          />
        </div>

        {/* File uploads */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
          <p
            id="upload-files-label"
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
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-describedby="upload-files-label"
            className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600 dark:hover:bg-gray-900"
            }`}
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragging
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:group-hover:bg-gray-700"
              }`}
            >
              <span className="text-2xl">+</span>
            </div>
            <span
              className={`mt-4 block text-sm font-medium ${
                isDragging
                  ? "text-blue-600 dark:text-blue-300"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {isDragging
                ? "ドロップして追加"
                : "ファイルを複数選択（またはドラッグ＆ドロップ）"}
            </span>
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              PDF, PPT, 画像 / 1ファイル最大50MB
            </span>
          </button>

          {files.length > 0 && (
            <ul className="mt-6 space-y-3">
              {files.map((entry, i) => (
                <li
                  key={i}
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
                      onChange={(e) => {
                        const updated = [...files];
                        updated[i] = {
                          ...entry,
                          fileType: e.target.value as FileEntry["fileType"],
                        };
                        setFiles(updated);
                      }}
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
                      onClick={() => removeFile(i)}
                      aria-label={`${entry.file.name} を削除`}
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

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex min-w-48 items-center justify-center rounded-xl bg-gray-950 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 dark:focus:ring-white dark:focus:ring-offset-gray-950"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                アップロード中...
              </span>
            ) : (
              "論文をアップロードする"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
