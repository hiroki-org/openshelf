"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { safePath } from "@/lib/sanitization";
import { getVisibilityBadge } from "@/lib/presentation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Org = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
};

type OrgPaper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
};

type Member = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
};

type OrgPageClientProps = {
  slug: string;
};

type SelectOption = {
  value: string | number;
  count: number;
};

type PapersResponse = {
  papers: OrgPaper[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedFilters?: {
    year?: number | null;
    venue?: string | null;
    category?: string | null;
  };
  filterOptions?: {
    years?: Array<{ value: number; count: number }>;
    venues?: Array<{ value: string; count: number }>;
    categories?: Array<{ value: string; count: number }>;
  };
};

function isPaginatedPapersResponse(value: unknown): value is PapersResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.papers) &&
    typeof record.total === "number" &&
    typeof record.page === "number" &&
    typeof record.totalPages === "number"
  );
}

export default function OrgPageClient({ slug }: OrgPageClientProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [org, setOrg] = useState<Org | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [orgPapers, setOrgPapers] = useState<OrgPaper[]>([]);
  const [papersTotal, setPapersTotal] = useState(0);
  const [orgPaperCount, setOrgPaperCount] = useState(0);
  const [papersPage, setPapersPage] = useState(1);
  const [papersTotalPages, setPapersTotalPages] = useState(1);
  const [yearOptions, setYearOptions] = useState<SelectOption[]>([]);
  const [venueOptions, setVenueOptions] = useState<SelectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
  const [appliedYear, setAppliedYear] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = members.some(
    (m) => m.userId === user?.id && (m.role === "admin" || m.role === "owner"),
  );

  const selectedYearParam = searchParams.get("year");
  const selectedYear = selectedYearParam === "all" ? "" : (selectedYearParam ?? "");
  const selectedVenue = searchParams.get("venue") ?? "";
  const selectedCategory = searchParams.get("category") ?? "";
  const selectedPage = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const autoYearEnabled = selectedYearParam === null;
  const displayedYear = autoYearEnabled ? (appliedYear ? String(appliedYear) : "") : selectedYear;

  const updateFilters = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (!Object.prototype.hasOwnProperty.call(changes, "page")) {
        params.delete("page");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const fetchOrgMeta = useCallback(async () => {
    try {
      const [orgRes, membersRes, collectionsRes] = await Promise.all([
        apiFetch(`/api/orgs/${safePath(slug)}`),
        apiFetch(`/api/orgs/${safePath(slug)}/members`),
        apiFetch(`/api/orgs/${safePath(slug)}/collections`),
      ]);

      if (!orgRes.ok) {
        setError(
          orgRes.status === 404 ? "組織が見つかりません" : "取得に失敗しました",
        );
        return;
      }

      const orgData = await orgRes.json();
      setOrg(orgData.org);
      setMemberCount(orgData.memberCount ?? 0);
      setOrgPaperCount(orgData.paperCount ?? 0);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members);
      }

      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json();
        setCollections(collectionsData.collections ?? []);
      }
    } catch {
      setError("取得に失敗しました");
    }
  }, [slug]);

  const fetchPapers = useCallback(async () => {
    try {
      const papersParams = new URLSearchParams();
      papersParams.set("paginate", "1");
      if (autoYearEnabled) papersParams.set("autoYear", "1");
      if (selectedYearParam === "all") {
        papersParams.set("year", "all");
      } else if (selectedYear) {
        papersParams.set("year", selectedYear);
      }
      if (selectedVenue) papersParams.set("venue", selectedVenue);
      if (selectedCategory) papersParams.set("category", selectedCategory);
      papersParams.set("page", String(selectedPage));
      const papersUrl = `/api/orgs/${safePath(slug)}/papers?${papersParams.toString()}`;

      const papersRes = await apiFetch(papersUrl);
      if (!papersRes.ok) return;

      const papersData = await papersRes.json();
      if (isPaginatedPapersResponse(papersData)) {
        setOrgPapers(papersData.papers);
        setPapersTotal(papersData.total);
        setPapersPage(papersData.page);
        setPapersTotalPages(papersData.totalPages);
        setAppliedYear(papersData.appliedFilters?.year ?? null);
        setYearOptions(
          (papersData.filterOptions?.years ?? []).map((option) => ({
            value: option.value,
            count: option.count,
          })),
        );
        setVenueOptions(
          (papersData.filterOptions?.venues ?? []).map((option) => ({
            value: option.value,
            count: option.count,
          })),
        );
        setCategoryOptions(
          (papersData.filterOptions?.categories ?? []).map((option) => ({
            value: option.value,
            count: option.count,
          })),
        );
      }
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [autoYearEnabled, selectedCategory, selectedPage, selectedVenue, selectedYear, selectedYearParam, slug]);

  useEffect(() => {
    fetchOrgMeta();
  }, [fetchOrgMeta]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  if (loading) return <div className="text-center py-20">読み込み中...</div>;
  if (error)
    return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!org) return null;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <p className="text-sm text-gray-500 mt-1">@{org.slug}</p>
            {org.description && (
              <p className="text-sm text-gray-600 mt-2 dark:text-gray-400">
                {org.description}
              </p>
            )}
          </div>
          {isAdmin && (
            <Link
              href={`/orgs/${slug}/settings`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              ⚙ 設定
            </Link>
          )}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-gray-500">
          <span>👥 {memberCount} メンバー</span>
          <span>📄 {orgPaperCount} 論文</span>
          <span>📚 {collections.length} コレクション</span>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">コレクション</h2>
          {isAdmin && (
            <Link
              href="/collections/new"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + 新規作成
            </Link>
          )}
        </div>

        {collections.length === 0 ? (
          <p className="text-sm text-gray-500">コレクションがありません</p>
        ) : (
          <ul className="space-y-2">
            {collections.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/orgs/${slug}/c/${c.slug}`}
                  className="block rounded-md border p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{c.name}</h3>
                      {c.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {c.visibility}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Members preview */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">メンバー</h2>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-2 text-sm rounded-md border p-2 dark:border-gray-700"
            >
              {m.avatarUrl && (
                <Image
                  src={m.avatarUrl}
                  alt={m.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{m.displayName ?? m.name}</span>
              <span className="text-xs text-gray-400 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Papers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">論文</h2>
          {isAdmin && (
            <Link
              href={`/orgs/${slug}/settings?tab=papers`}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + 論文を追加
            </Link>
          )}
        </div>
        <div className="mb-4 rounded-md border p-3 dark:border-gray-700">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">年度</span>
              <select
                className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                value={displayedYear}
                onChange={(e) => updateFilters({ year: e.target.value ? e.target.value : "all" })}
              >
                <option value="">全て</option>
                {yearOptions.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.value} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">Venue</span>
              <select
                className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                value={selectedVenue}
                onChange={(e) => updateFilters({ venue: e.target.value || null })}
              >
                <option value="">全て</option>
                {venueOptions.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.value} ({option.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">カテゴリ</span>
              <select
                className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                value={selectedCategory}
                onChange={(e) => updateFilters({ category: e.target.value || null })}
              >
                <option value="">全て</option>
                {categoryOptions.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.value} ({option.count})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{papersTotal}件の論文が見つかりました</span>
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={() => router.replace(pathname)}
            >
              フィルタをクリア
            </button>
          </div>
        </div>

        {orgPapers.length === 0 ? (
          <p className="text-sm text-gray-500">まだ論文がありません</p>
        ) : (
          <ul className="space-y-3">
            {orgPapers.map((p) => {
              const badge = getVisibilityBadge(p.visibility);
              return (
                <li key={p.id}>
                  <Link
                    href={`/papers/${p.id}`}
                    className="block rounded-md border p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">
                          {p.title}
                        </h3>
                        {p.abstract && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {p.abstract}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                          {p.year && <span>{p.year}年</span>}
                          {p.venue && <span>{p.venue}</span>}
                          {p.category && <span>{p.category}</span>}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {papersTotalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-700"
              disabled={papersPage <= 1}
              onClick={() => updateFilters({ page: String(papersPage - 1) })}
            >
              前へ
            </button>
            <span>
              {papersPage} / {papersTotalPages}
            </span>
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-700"
              disabled={papersPage >= papersTotalPages}
              onClick={() => updateFilters({ page: String(papersPage + 1) })}
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
