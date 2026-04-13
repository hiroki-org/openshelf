"use client";

import { FeedButton } from "@/components/feed-button";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { safePath } from "@/lib/sanitization";

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

type UserCollectionPageClientProps = {
  id: string;
  collectionSlug: string;
};

export default function UserCollectionPageClient({
  id,
  collectionSlug,
}: UserCollectionPageClientProps) {
  const feedUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/feed/users/${id}/collections/${collectionSlug}/atom.xml`;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const listRes = await apiFetch(
          `/api/users/${safePath(id)}/collections`,
        );
        const listData = listRes.ok
          ? await listRes.json()
          : { collections: [] };
        if (cancelled) return;

        const found =
          (listData.collections ?? []).find(
            (c: Collection) => c.slug === collectionSlug,
          ) ?? null;
        if (!found) {
          setError("コレクションが見つかりません");
          return;
        }
        setCollection(found);

        const papersRes = await apiFetch(
          `/api/collections/${safePath(found.id)}/papers`,
        );
        if (!papersRes.ok) return;

        const papersData = await papersRes.json();
        if (cancelled) return;
        setPapers(
          (papersData.papers ?? [])
            .slice()
            .sort((a: Paper, b: Paper) => a.sortOrder - b.sortOrder),
        );
      } catch {
        if (cancelled) return;
        setError("取得に失敗しました");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, collectionSlug]);

  if (error)
    return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!collection)
    return <div className="text-center py-16">読み込み中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/users/${safePath(id)}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ユーザーページに戻る
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            {collection.description && (
              <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
                {collection.description}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              visibility: {collection.visibility}
            </p>
          </div>
          <FeedButton url={feedUrl} />
        </div>
      </div>

      {papers.length === 0 ? (
        <p className="text-sm text-gray-500">論文がありません</p>
      ) : (
        <ul className="space-y-3">
          {papers.map((paper) => (
            <li
              key={paper.id}
              className="rounded-md border p-3 dark:border-gray-700"
            >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
