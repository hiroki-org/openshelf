"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getVisibilityBadge } from "@/lib/presentation";

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
    apiFetch("/api/papers", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return { papers: [] as Paper[] };
        return r.json();
      })
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setPapers([]));
  }, [user]);

  const recentPapers = useMemo(
    () =>
      [...papers].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [papers],
  );

  const stats = useMemo(() => {
    return {
      total: papers.length,
      publicCount: papers.filter((paper) => paper.visibility === "public")
        .length,
      withCategory: papers.filter((paper) => Boolean(paper.category)).length,
    };
  }, [papers]);

  if (loading) return <div className="py-20 text-center">読み込み中...</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white/90 px-6 py-10 shadow-sm dark:border-gray-800 dark:bg-gray-950/80 sm:px-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                Research output hosting
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-gray-950 dark:text-gray-50 sm:text-5xl">
                研究成果物を、整った形で保存して共有する。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-400 sm:text-lg">
                OpenShelf は、論文・スライド・補足資料をまとめて管理し、
                永続URLで落ち着いて共有できるホスティング基盤です。
                華美に飾るのではなく、研究情報が読みやすく伝わることを大事にしています。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={login}
                  className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  GitHubでログイン
                </button>
                <Link
                  href="/upload"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  アップロード画面を見る
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  1. 成果物をまとめる
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  論文、発表資料、ポスター、補足資料をひとつの単位で整理できます。
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  2. 公開範囲を選ぶ
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  非公開・組織内・公開を使い分けて、共有先に応じた見せ方にできます。
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  3. 永続URLで共有
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  研究室内の参照や外部向け案内にも使いやすい、安定した導線を用意できます。
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              ダッシュボード
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
              マイ論文
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
              アップロード済みの研究成果物を一覧で確認できます。タイトル、公開範囲、
              基本メタデータをすばやく見直せます。
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            + アップロード
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">登録済み</p>
            <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-gray-50">
              {stats.total}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              すべての成果物
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">公開中</p>
            <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-gray-50">
              {stats.publicCount}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              外部共有可能
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              カテゴリ設定済み
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-950 dark:text-gray-50">
              {stats.withCategory}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              分類情報あり
            </p>
          </div>
        </div>
      </section>

      {recentPapers.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center dark:border-gray-700 dark:bg-gray-900/60">
          <div className="mx-auto max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              まだ論文がありません
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              最初の成果物を追加すると、この画面から一覧で確認できるようになります。
            </p>
            <Link
              href="/upload"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
            >
              アップロードをはじめる
            </Link>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
                最近の成果物
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                新しい順に表示しています。
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {recentPapers.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/papers/${p.id}`}
                  className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const badge = getVisibilityBadge(p.visibility);
                          return (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                        {p.year && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {p.year}年
                          </span>
                        )}
                        {p.category && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {p.category}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-gray-950 transition-colors group-hover:text-gray-700 dark:text-gray-50 dark:group-hover:text-gray-200">
                        {p.title}
                      </h3>
                    </div>

                    <div className="text-sm text-gray-400 transition-transform group-hover:translate-x-0.5">
                      →
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
