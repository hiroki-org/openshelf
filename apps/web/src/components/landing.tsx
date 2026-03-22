"use client";

import { useAuth } from "@/components/auth-provider";

export function LandingHero() {
  const { login } = useAuth();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
        Research output hosting
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-950 dark:text-gray-50 sm:text-6xl">
        研究成果物を保存し、
        <br className="hidden sm:block" />
        共有する。
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-400">
        OpenShelf は、論文・スライド・補足資料などをまとめて管理し、
        永続URLで簡単に共有できるホスティングプラットフォームです。
      </p>
      <div className="mt-10 flex items-center justify-center">
        <button
          type="button"
          onClick={login}
          className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-gray-900 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 dark:focus-visible:outline-white"
        >
          GitHubでログイン
        </button>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "1. 成果物をまとめる",
    description: "論文、発表資料、ポスター、補足資料をひとつの単位で整理できます。",
    icon: {
      path: "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
      textClass: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    title: "2. 公開範囲を選ぶ",
    description: "非公開・組織内・公開を使い分けて、共有先に応じた見せ方にできます。",
    icon: {
      path: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
      bgClass: "bg-green-100 dark:bg-green-900/30",
      textClass: "text-green-600 dark:text-green-400",
    },
  },
  {
    title: "3. 永続URLで共有",
    description: "研究室内の参照や外部向け案内にも使いやすい、安定した導線を用意できます。",
    icon: {
      path: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
      bgClass: "bg-purple-100 dark:bg-purple-900/30",
      textClass: "text-purple-600 dark:text-purple-400",
    },
  },
] as const;

export function LandingFeatures() {
  return (
    <div className="mt-20 grid gap-6 sm:grid-cols-3 text-left">
      {FEATURES.map((feature) => (
        <div
          key={feature.title}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:bg-gray-900"
        >
          <div
            className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${feature.icon.bgClass}`}
          >
            <svg
              className={`h-6 w-6 ${feature.icon.textClass}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={feature.icon.path}
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {feature.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
