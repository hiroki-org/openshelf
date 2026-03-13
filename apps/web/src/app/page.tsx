"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getVisibilityBadge } from "@/lib/presentation";

const CATEGORY_LABELS: Record<string, string> = {
  thesis_bachelor: "学士論文",
  thesis_master: "修士論文",
  report: "レポート",
  conference_paper: "学会論文",
  journal_paper: "学術論文",
  other: "その他",
};

type Paper = {
  id: string;
  title: string;
  visibility: string;
  year: number | null;
  category: string | null;
  createdAt: string;
};

const toCreatedAtMs = (value: string) =>
  Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

export default function Home() {
  const { user, loading, login } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoading, setPapersLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setPapers([]);
      return;
    }
    setPapersLoading(true);
    apiFetch("/api/papers")
      .then(async (r) => {
        if (!r.ok) return { papers: [] as Paper[] };
        return r.json();
      })
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setPapers([]))
      .finally(() => setPapersLoading(false));
  }, [user]);

  const recentPapers = useMemo(
    () =>
      [...papers].sort(
        (a, b) => toCreatedAtMs(b.createdAt) - toCreatedAtMs(a.createdAt),
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
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white/90 px-6 py-16 shadow-sm dark:border-gray-800 dark:bg-gray-950/80 sm:px-10 sm:py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
              Research output hosting
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 dark:text-gray-50 sm:text-6xl">
              研究成果物を、整った形で<br className="hidden sm:block" />保存して共有する。
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-400">
              OpenShelf は、論文・スライド・補足資料をまとめて管理し、
              永続URLで落ち着いて共有できるホスティング基盤です。
              華美に飾るのではなく、研究情報が読みやすく伝わることを大事にしています。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={login}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-gray-900 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:focus-visible:outline-white"
              >
                GitHubでログイン
              </button>
              <button
                type="button"
                onClick={login}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                ログインしてアップロード
              </button>
            </div>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-900">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
<svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                1. 成果物をまとめる
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                論文、発表資料、ポスター、補足資料をひとつの単位で整理できます。
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-900">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                2. 公開範囲を選ぶ
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                非公開・組織内・公開を使い分けて、共有先に応じた見せ方にできます。
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-900">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                3. 永続URLで共有
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                研究室内の参照や外部向け案内にも使いやすい、安定した導線を用意できます。
              </p>
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

      {!papersLoading && recentPapers.length === 0 ? (
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
            {recentPapers.map((p) => {
              const badge = getVisibilityBadge(p.visibility);
              return (
                <li key={p.id}>
                  <Link
                    href={`/papers/${p.id}`}
                    className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {p.year && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {p.year}年
                            </span>
                          )}
                          {p.category && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {CATEGORY_LABELS[p.category] ?? p.category}
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
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
