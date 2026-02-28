"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const VALID_FILE_TYPES = [
  "paper",
  "slides",
  "poster",
  "supplementary",
] as const;
const VISIBILITY_OPTIONS = ["public", "org_only", "private"] as const;
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
    useState<(typeof VISIBILITY_OPTIONS)[number]>("private");
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

    const res = await fetch("/api/papers", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/papers/${data.paper.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "アップロードに失敗しました");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">論文アップロード</h1>

      <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        著者最終稿（Author Accepted
        Manuscript）をアップロードしてください。出版社版のアップロードは著作権上の問題がある場合があります。
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">概要</label>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">公開範囲</label>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target.value as (typeof VISIBILITY_OPTIONS)[number],
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="private">非公開</option>
              <option value="org_only">組織内</option>
              <option value="public">公開</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">発表年</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">会場名</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">会場種別</label>
            <select
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
          <label className="block text-sm font-medium mb-1">カテゴリ</label>
          <select
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
          <label className="block text-sm font-medium mb-1">
            タグ（カンマ区切り）
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="例: NLP, LLM, attention"
          />
        </div>

        {/* File uploads */}
        <div>
          <label className="block text-sm font-medium mb-1">
            ファイル <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg"
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-dashed border-gray-400 px-4 py-8 w-full text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-900"
          >
            クリックしてファイルを選択（PDF, PPT, 画像 / 最大50MB）
          </button>

          {files.length > 0 && (
            <ul className="mt-2 space-y-2">
              {files.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm border rounded-md p-2 dark:border-gray-700"
                >
                  <span className="flex-1 truncate">{entry.file.name}</span>
                  <select
                    value={entry.fileType}
                    onChange={(e) => {
                      const updated = [...files];
                      updated[i] = {
                        ...entry,
                        fileType: e.target.value as FileEntry["fileType"],
                      };
                      setFiles(updated);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
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
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {uploading ? "アップロード中..." : "アップロード"}
        </button>
      </form>
    </div>
  );
}
