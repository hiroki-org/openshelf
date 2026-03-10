"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
              基本情報
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              まずは論文のタイトルと概要を入力します。
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="paper-title"
                className="mb-1 block text-sm font-medium"
              >
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                id="paper-title"
                type="text"
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                required
              />
            </div>

            <div>
              <label
                htmlFor="paper-abstract"
                className="mb-1 block text-sm font-medium"
              >
                概要
              </label>
              <textarea
                id="paper-abstract"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
              メタデータ
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              検索や整理に役立つ情報を任意で追加できます。
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="paper-visibility"
                  className="mb-1 block text-sm font-medium"
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
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
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
                  className="mb-1 block text-sm font-medium"
                >
                  発表年
                </label>
                <input
                  id="paper-year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="paper-venue"
                  className="mb-1 block text-sm font-medium"
                >
                  会場名
                </label>
                <input
                  id="paper-venue"
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <div>
                <label
                  htmlFor="paper-venue-type"
                  className="mb-1 block text-sm font-medium"
                >
                  会場種別
                </label>
                <select
                  id="paper-venue-type"
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
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
                className="mb-1 block text-sm font-medium"
              >
                カテゴリ
              </label>
              <select
                id="paper-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
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
                className="mb-1 block text-sm font-medium"
              >
                タグ（カンマ区切り）
              </label>
              <input
                id="paper-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="例: NLP, LLM, attention"
              />
            </div>
          </div>
        </section>

        {/* File uploads */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
              ファイル
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              PDF、スライド、画像などの関連資料を追加できます。
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              添付ファイル <span className="text-red-500">*</span>
            </label>
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
              className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              <span className="block font-medium text-gray-900 dark:text-gray-100">
                クリックしてファイルを選択
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                PDF, PPT, 画像 / 最大50MB
              </span>
            </button>

            {files.length > 0 && (
              <ul className="mt-4 space-y-3">
                {files.map((entry, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {entry.file.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        種別を選択して整理できます
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
                        className="rounded-xl border border-gray-300 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
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
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex min-w-40 items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {uploading ? "アップロード中..." : "アップロード"}
          </button>
        </div>
      </form>
    </div>
  );
}
