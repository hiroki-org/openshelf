"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

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

export default function OrgPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [orgPapers, setOrgPapers] = useState<OrgPaper[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = members.some(
    (m) => m.userId === user?.id && (m.role === "admin" || m.role === "owner"),
  );

  const fetchOrg = useCallback(async () => {
    try {
      const [orgRes, papersRes, membersRes] = await Promise.all([
        apiFetch(`/api/orgs/${slug}`),
        apiFetch(`/api/orgs/${slug}/papers`),
        apiFetch(`/api/orgs/${slug}/members`),
      ]);

      if (!orgRes.ok) {
        setError(orgRes.status === 404 ? "組織が見つかりません" : "取得に失敗しました");
        return;
      }

      const orgData = await orgRes.json();
      setOrg(orgData.org);
      setMemberCount(orgData.memberCount);

      if (papersRes.ok) {
        const papersData = await papersRes.json();
        setOrgPapers(papersData.papers);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members);
      }

      const collectionsRes = await apiFetch(`/api/orgs/${slug}/collections`);
      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json();
        setCollections(collectionsData.collections ?? []);
      }
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  if (loading) return <div className="text-center py-20">読み込み中...</div>;
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!org) return null;

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "public":
        return { label: "公開", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" };
      case "org_only":
        return { label: "組織限定", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" };
      case "private":
        return { label: "非公開", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" };
      default:
        return { label: visibility, className: "bg-gray-100 text-gray-700 dark:bg-gray-800" };
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <p className="text-sm text-gray-500 mt-1">@{org.slug}</p>
            {org.description && (
              <p className="text-sm text-gray-600 mt-2 dark:text-gray-400">{org.description}</p>
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
          <span>📄 {orgPapers.length} 論文</span>
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
                      {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{c.visibility}</span>
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
            <div key={m.userId} className="flex items-center gap-2 text-sm rounded-md border p-2 dark:border-gray-700">
              {m.avatarUrl && (
                <Image src={m.avatarUrl} alt={m.name} width={24} height={24} className="rounded-full" />
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
                        <h3 className="font-medium text-sm truncate">{p.title}</h3>
                        {p.abstract && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.abstract}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                          {p.year && <span>{p.year}年</span>}
                          {p.venue && <span>{p.venue}</span>}
                          {p.category && <span>{p.category}</span>}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
