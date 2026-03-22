"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export const VISIBILITY_OPTIONS = [
  { value: "private", label: "非公開" },
  { value: "org_only", label: "組織内" },
  { value: "public", label: "公開" },
] as const;
export type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

export const CATEGORY_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "thesis_bachelor", label: "学士論文" },
  { value: "thesis_master", label: "修士論文" },
  { value: "report", label: "レポート" },
  { value: "presentation", label: "プレゼンテーション" },
  { value: "other", label: "その他" },
] as const;

export const VENUE_TYPE_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "conference", label: "学会" },
  { value: "journal", label: "ジャーナル" },
  { value: "workshop", label: "ワークショップ" },
  { value: "other", label: "その他" },
] as const;

export type PaperEditData = {
  title: string | null;
  abstract: string | null;
  visibility: VisibilityValue;
  showViewCount: boolean;
  language: string | null;
  externalUrl: string | null;
  doi: string | null;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
};

type Props = {
  paperId: string;
  initialData: PaperEditData;
};

export function PaperEditForm({ paperId, initialData }: Props) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialVisibility = initialData.visibility;

  // Form states
  const [title, setTitle] = useState(initialData.title || "");
  const [abstract, setAbstract] = useState(initialData.abstract || "");
  const [visibility, setVisibility] = useState<VisibilityValue>(initialData.visibility);
  const [showViewCount, setShowViewCount] = useState(initialData.showViewCount);
  const [language, setLanguage] = useState(initialData.language || "");
  const [externalUrl, setExternalUrl] = useState(initialData.externalUrl || "");
  const [doi, setDoi] = useState(initialData.doi || "");
  const [venue, setVenue] = useState(initialData.venue || "");
  const [venueType, setVenueType] = useState(initialData.venueType || "");
  const [year, setYear] = useState(initialData.year ? String(initialData.year) : "");
  const [category, setCategory] = useState(initialData.category || "");

  let initialTags = "";
  if (initialData.tags) {
    try {
      const parsed = JSON.parse(initialData.tags);
      if (Array.isArray(parsed)) {
        initialTags = parsed.join(", ");
      }
    } catch {
      initialTags = String(initialData.tags);
    }
  }
  const [tagsStr, setTagsStr] = useState(initialTags);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }

    setSubmitting(true);

    try {
      const parsedYear = year ? parseInt(year, 10) : null;
      if (year && isNaN(parsedYear!)) {
        throw new Error("年は数値で入力してください。");
      }

      const tagsArray = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        abstract: abstract.trim() || null,
        visibility,
        showViewCount,
        language: language.trim() || null,
        externalUrl: externalUrl.trim() || null,
        doi: doi.trim() || null,
        venue: venue.trim() || null,
        venueType: venueType || null,
        year: parsedYear,
        category: category || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };

      const res = await apiFetch(`/api/papers/${encodeURIComponent(paperId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "メタデータの更新に失敗しました");
      }

      router.push(`/papers/${paperId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const visibilityOptions =
    initialVisibility === "org_only"
      ? VISIBILITY_OPTIONS
      : VISIBILITY_OPTIONS.filter((option) => option.value !== "org_only");

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">メタデータの編集</h1>
        <Link
          href={`/papers/${paperId}`}
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          キャンセル
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="論文のタイトル"
          />
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium">公開範囲</legend>
          <div className="flex gap-4">
            {visibilityOptions.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <input
                  id={`visibility-${opt.value}`}
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={(e) =>
                    setVisibility(e.target.value as VisibilityValue)
                  }
                />
                <label htmlFor={`visibility-${opt.value}`} className="text-sm">
                  {opt.label}
                </label>
              </div>
            ))}
          </div>
          {initialVisibility !== "org_only" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              組織公開への変更は対象組織を選べないため、この編集画面では未対応です。
            </p>
          )}
          {initialVisibility === "org_only" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              現在の組織公開設定は維持できますが、公開先組織自体の編集は未対応です。
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {visibility === "private" && "あなたと共著者のみが閲覧可能です。"}
            {visibility === "org_only" && "所属組織のメンバーのみが閲覧可能です。"}
            {visibility === "public" && "誰でも閲覧可能です。"}
          </p>
        </fieldset>

        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <label
            htmlFor="show-view-count"
            className="flex items-start gap-3"
          >
            <input
              id="show-view-count"
              type="checkbox"
              checked={showViewCount}
              onChange={(e) => setShowViewCount(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
            <span>
              <span className="block text-sm font-medium">
                公開ページに閲覧数を表示する
              </span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">
                著者向けの詳細統計は常に閲覧できます。この設定は、一般閲覧者向けに総閲覧数を表示するかどうかだけを切り替えます。
              </span>
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="abstract" className="mb-1 block text-sm font-medium">概要</label>
          <textarea
            id="abstract"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="アブストラクト..."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium">カテゴリ</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="year" className="mb-1 block text-sm font-medium">発表年</label>
            <input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label htmlFor="venue" className="mb-1 block text-sm font-medium">発表場所（学会名など）</label>
            <input
              id="venue"
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="情報処理学会 全国大会"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label htmlFor="venue-type" className="mb-1 block text-sm font-medium">発表種別</label>
            <select
              id="venue-type"
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            >
              {VENUE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="language" className="mb-1 block text-sm font-medium">言語</label>
            <input
              id="language"
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="ja, en"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <div>
            <label htmlFor="doi" className="mb-1 block text-sm font-medium">DOI</label>
            <input
              id="doi"
              type="text"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.1234/5678"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="external-url" className="mb-1 block text-sm font-medium">外部リンク</label>
          <input
            id="external-url"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://doi.org/..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="tags" className="mb-1 block text-sm font-medium">
            タグ <span className="text-gray-500 font-normal text-xs">（カンマ区切り）</span>
          </label>
          <input
            id="tags"
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="AI, NLP, Machine Learning"
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-800">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? "保存中..." : "保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}
