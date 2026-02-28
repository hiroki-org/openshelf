"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState } from "react";

type Paper = {
  id: string;
  title: string;
  visibility: string;
  year: number | null;
  category: string | null;
  createdAt: string;
};

export default function Home() {
  const { user, loading, login } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/papers", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return { papers: [] as Paper[] };
        return r.json();
      })
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setPapers([]));
  }, [user]);

  if (loading) return <div className="text-center py-20">読み込み中...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <h1 className="text-4xl font-bold">OpenShelf</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg text-center max-w-md">
          研究成果物をアップロードし、永続URLで共有できるホスティングサービス
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-md bg-gray-900 px-6 py-2.5 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          GitHubでログイン
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">マイ論文</h1>
        <Link
          href="/upload"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          + アップロード
        </Link>
      </div>
      {papers.length === 0 ? (
        <p className="text-gray-500 py-12 text-center">
          まだ論文がありません。
          <Link href="/upload" className="underline">
            アップロード
          </Link>
          してみましょう。
        </p>
      ) : (
        <ul className="space-y-3">
          {papers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/papers/${p.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-gray-400">{p.visibility}</span>
                </div>
                {(p.year || p.category) && (
                  <div className="mt-1 text-sm text-gray-500">
                    {p.year && <span>{p.year}年</span>}
                    {p.category && <span className="ml-2">{p.category}</span>}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
