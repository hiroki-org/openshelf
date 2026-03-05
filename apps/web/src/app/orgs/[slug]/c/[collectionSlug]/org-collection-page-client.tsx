"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
};

type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
  sortOrder: number;
};

type Member = { userId: string; role: string };

type OrgCollectionPageClientProps = {
  slug: string;
  collectionSlug: string;
};

export default function OrgCollectionPageClient({
  slug,
  collectionSlug,
}: OrgCollectionPageClientProps) {
  const { user } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  const isAdmin = useMemo(
    () =>
      members.some(
        (m) =>
          m.userId === user?.id && (m.role === "admin" || m.role === "owner"),
      ),
    [members, user],
  );

  const reload = useCallback(async () => {
    try {
      const listRes = await apiFetch(`/api/orgs/${slug}/collections`);
      const listData = listRes.ok ? await listRes.json() : { collections: [] };
      const found =
        (listData.collections ?? []).find(
          (c: Collection) => c.slug === collectionSlug,
        ) ?? null;
      if (!found) {
        setError("コレクションが見つかりません");
        return;
      }
      setCollection(found);

      const [papersRes, membersRes] = await Promise.all([
        apiFetch(`/api/collections/${found.id}/papers`),
        apiFetch(`/api/orgs/${slug}/members`),
      ]);

      if (papersRes.ok) {
        const papersData = await papersRes.json();
        setPapers(
          (papersData.papers ?? [])
            .slice()
            .sort((a: Paper, b: Paper) => a.sortOrder - b.sortOrder),
        );
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members ?? []);
      }
    } catch {
      setError("取得に失敗しました");
    }
  }, [collectionSlug, slug]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const move = async (index: number, direction: -1 | 1) => {
    if (!collection) return;
    const next = index + direction;
    if (next < 0 || next >= papers.length) return;

    const newOrder = [...papers];
    const tmp = newOrder[index];
    newOrder[index] = newOrder[next];
    newOrder[next] = tmp;
    setPapers(newOrder.map((p, i) => ({ ...p, sortOrder: i })));

    await apiFetch(`/api/collections/${collection.id}/papers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_ids: newOrder.map((p) => p.id) }),
    });
  };

  if (error)
    return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!collection)
    return <div className="text-center py-16">読み込み中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/orgs/${slug}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 組織ページに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-2">{collection.name}</h1>
        {collection.description && (
          <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
            {collection.description}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          visibility: {collection.visibility}
        </p>
      </div>

      {papers.length === 0 ? (
        <p className="text-sm text-gray-500">論文がありません</p>
      ) : (
        <ul className="space-y-3">
          {papers.map((paper, idx) => (
            <li
              key={paper.id}
              className="rounded-md border p-3 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/papers/${paper.id}`}
                    className="font-medium hover:underline"
                  >
                    {paper.title}
                  </Link>
                  {paper.abstract && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {paper.abstract}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    visibility: {paper.visibility}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void move(idx, -1)}
                      className="rounded border px-2 py-1 text-xs dark:border-gray-700"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void move(idx, 1)}
                      className="rounded border px-2 py-1 text-xs dark:border-gray-700"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
