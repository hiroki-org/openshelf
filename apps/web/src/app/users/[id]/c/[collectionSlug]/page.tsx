"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function UserCollectionPage() {
  const { id, collectionSlug } = useParams<{ id: string; collectionSlug: string }>();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const listRes = await apiFetch(`/api/users/${id}/collections`);
        const listData = listRes.ok ? await listRes.json() : { collections: [] };
        const found = (listData.collections ?? []).find((c: Collection) => c.slug === collectionSlug) ?? null;
        if (!found) {
          setError("コレクションが見つかりません");
          return;
        }
        setCollection(found);

        const papersRes = await apiFetch(`/api/collections/${found.id}/papers`);
        if (papersRes.ok) {
          const papersData = await papersRes.json();
          setPapers((papersData.papers ?? []).slice().sort((a: Paper, b: Paper) => a.sortOrder - b.sortOrder));
        }
      } catch {
        setError("取得に失敗しました");
      }
    })();
  }, [id, collectionSlug]);

  if (error) return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!collection) return <div className="text-center py-16">読み込み中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href={`/users/${id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← ユーザーページに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-2">{collection.name}</h1>
        {collection.description && <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">{collection.description}</p>}
        <p className="text-xs text-gray-500 mt-2">visibility: {collection.visibility}</p>
      </div>

      {papers.length === 0 ? (
        <p className="text-sm text-gray-500">論文がありません</p>
      ) : (
        <ul className="space-y-3">
          {papers.map((paper) => (
            <li key={paper.id} className="rounded-md border p-3 dark:border-gray-700">
              <Link href={`/papers/${paper.id}`} className="font-medium hover:underline">
                {paper.title}
              </Link>
              {paper.abstract && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{paper.abstract}</p>}
              <p className="text-xs text-gray-400 mt-1">visibility: {paper.visibility}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
