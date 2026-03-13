"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

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

type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

const isVisibilityValue = (value: string): value is VisibilityValue =>
  VISIBILITY_OPTIONS.some((opt) => opt.value === value);

export default function PaperEditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const paperId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [visibility, setVisibility] = useState<VisibilityValue | null>(null);
  const [language, setLanguage] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [doi, setDoi] = useState("");
  const [venue, setVenue] = useState("");
  const [venueType, setVenueType] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [languageLoaded, setLanguageLoaded] = useState(false);
  const [doiLoaded, setDoiLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPaper = async () => {
      try {
        const res = await apiFetch(`/api/papers/${encodeURIComponent(paperId)}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.replace("/");
            return;
          }
          throw new Error("論文の取得に失敗しました");
        }

        const data = await res.json();
        const paper = data.paper as Record<string, unknown>;

        // Ensure user is an author
        const isAuthor = data.authors.some((a: any) => a.userId === user.id);
        if (!isAuthor) {
          router.replace(`/papers/${paperId}`);
          return;
        }

        setTitle(typeof paper.title === "string" ? paper.title : "");
        setAbstract(typeof paper.abstract === "string" ? paper.abstract : "");
        if (typeof paper.visibility === "string" && isVisibilityValue(paper.visibility)) {
          setVisibility(paper.visibility);
        } else {
          setVisibility("private");
        }
        if ("language" in paper) {
          setLanguageLoaded(true);
          setLanguage(typeof paper.language === "string" ? paper.language : "");
        } else {
          setLanguageLoaded(false);
          setLanguage("");
        }
        setExternalUrl(typeof paper.externalUrl === "string" ? paper.externalUrl : "");
        if ("doi" in paper) {
          setDoiLoaded(true);
          setDoi(typeof paper.doi === "string" ? paper.doi : "");
        } else {
          setDoiLoaded(false);
          setDoi("");
        }
        setVenue(typeof paper.venue === "string" ? paper.venue : "");
        setVenueType(typeof paper.venueType === "string" ? paper.venueType : "");
        setYear(typeof paper.year === "number" && Number.isInteger(paper.year) ? String(paper.year) : "");
        setCategory(typeof paper.category === "string" ? paper.category : "");

        let initialTags = "";
        if (typeof paper.tags === "string" && paper.tags.length > 0) {
            try {
              const parsed = JSON.parse(paper.tags);
              if (Array.isArray(parsed)) {
                    initialTags = parsed.join(", ");
                }
            } catch {
                initialTags = String(paper.tags);
            }
        }
        setTagsStr(initialTags);
      } catch (err: any) {
        setError(err.message || "予期せぬエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [paperId, user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!visibility) {
      setError("公開範囲を選択してください。");
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

      const payload: Record<string, unknown> = {
        title: title.trim(),
        abstract: abstract.trim() || null,
        visibility,
        externalUrl: externalUrl.trim() || null,
        venue: venue.trim() || null,
        venueType: venueType || null,
        year: parsedYear,
        category: category || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };
      if (languageLoaded) {
        payload.language = language.trim() || null;
      }
      if (doiLoaded) {
        payload.doi = doi.trim() || null;
      }

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
    } catch (err: any) {
      setError(err.message || "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

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
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
            placeholder="論文のタイトル"
          />
        </div>

        <div>
          <fieldset>
            <legend className="mb-1 block text-sm font-medium">公開範囲</legend>
            <div className="flex gap-4">
              {VISIBILITY_OPTIONS.map((opt) => {
                const id = `visibility-${opt.value}`;
                return (
                  <div key={opt.value} className="flex items-center gap-2">
                    <input
                      id={id}
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (isVisibilityValue(next)) {
                          setVisibility(next);
                        }
                      }}
                    />
                    <label htmlFor={id} className="text-sm">
                      {opt.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <p className="mt-1 text-xs text-gray-500">
            {visibility === "private" && "あなたと共著者のみが閲覧可能です。"}
            {visibility === "org_only" && "所属組織のメンバーのみが閲覧可能です。"}
            {visibility === "public" && "誰でも閲覧可能です。"}
          </p>
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
