"use client";

import { toast } from "@/components/toast";
import { useMemo } from "react";

type BadgeSnippetProps = {
  paperId: string;
  title: string;
  siteBase: string;
};

type SnippetItem = {
  key: "markdown" | "html" | "shields";
  label: string;
  value: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toAbsoluteUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function urlEncode(value: string): string {
  return encodeURIComponent(value);
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : "#";
  } catch {
    return url.startsWith("/") ? url : "#";
  }
}

export function BadgeSnippet({ paperId, title, siteBase }: BadgeSnippetProps) {
  const { snippets, badgePreviewUrl } = useMemo(() => {
    const normalizedSiteBase =
      siteBase.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    const badgeSvgUrl = toAbsoluteUrl(
      API_BASE,
      `/badge/${urlEncode(paperId)}?style=default&label=OpenShelf`,
    );
    const paperUrl = toAbsoluteUrl(
      normalizedSiteBase,
      `/papers/${urlEncode(paperId)}`,
    );
    const shieldsEndpointUrl = toAbsoluteUrl(
      API_BASE,
      `/badge/api/${urlEncode(paperId)}`,
    );
    const shieldsImageUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(
      shieldsEndpointUrl,
    )}`;

    const safePaperUrl = sanitizeUrl(paperUrl);

    const items: SnippetItem[] = [
      {
        key: "markdown",
        label: "Markdown",
        value: `[![OpenShelf Badge](${badgeSvgUrl})](${safePaperUrl})`,
      },
      {
        key: "html",
        label: "HTML",
        value: `<a href="${escapeHtmlAttribute(safePaperUrl)}"><img src="${escapeHtmlAttribute(badgeSvgUrl)}" alt="OpenShelf badge for ${escapeHtmlAttribute(title)}" /></a>`,
      },
      {
        key: "shields",
        label: "shields.io",
        value: `[![OpenShelf Badge](${shieldsImageUrl})](${safePaperUrl})`,
      },
    ];
    return { snippets: items, badgePreviewUrl: badgeSvgUrl };
  }, [paperId, title, siteBase]);

  const copySnippet = async (value: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error("このブラウザではクリップボード機能を利用できません");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("コピーしました");
    } catch {
      toast.error("クリップボードへのコピーに失敗しました");
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-300">
        Badge
      </h2>

      <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
        <img
          src={badgePreviewUrl}
          alt={`OpenShelf badge preview for ${title}`}
          className="h-5 w-auto"
        />
      </div>

      <div className="space-y-3">
        {snippets.map((snippet) => (
          <div
            key={snippet.key}
            className="rounded-md border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-300">
              <span>{snippet.label}</span>
              <button
                type="button"
                aria-label={`Copy ${snippet.label}`}
                className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-500"
                onClick={() => copySnippet(snippet.value)}
              >
                Copy
              </button>
            </div>
            <pre className="overflow-x-auto p-3 text-xs text-gray-700 dark:text-gray-200">
              <code>{snippet.value}</code>
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}
