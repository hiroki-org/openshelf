"use client";

import { useAuth } from "@/components/auth-provider";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { safePath } from "@/lib/sanitization";
import {
  getVisibilityBadge,
  getInviteStatusBadge,
  getRoleBadge,
} from "@/lib/presentation";
import { CiteButton } from "./cite-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { BadgeSnippet } from "./badge-snippet";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PdfViewer),
  { ssr: false },
);

type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  description: string | null;
  descriptionUpdatedAt: string | null;
  visibility: string;
  showViewCount: boolean;
  publicViewCount: number | null;
  publicDownloadCount: number | null;
  externalUrl: string | null;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaperFile = {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  mimeType: string | null;
  downloadUrl: string;
};

type Author = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Invite = {
  id: string;
  inviteeId: string | null;
  inviteeName: string;
  status: string;
  createdAt: string;
};

type SearchUser = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type PreviewResponse = {
  url: string;
  mimeType: string;
  filename: string;
};

type PaperStats = {
  total: {
    views: number;
    downloads: number;
    previews: number;
  };
  daily: Array<{
    date: string;
    views: number;
    downloads: number;
    previews: number;
  }>;
  days: 7 | 30 | 90 | 365;
};

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const isValidExternalUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

type PaperDetailClientProps = {
  paperId: string;
  siteBase: string;
};

function formatStatsDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

function revokeUrlsIdle(urls: string[]) {
  if (urls.length === 0) return;
  const urlsToRevoke = [...urls];

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const revokeChunk = (deadline: IdleDeadline) => {
      while (urlsToRevoke.length > 0 && deadline.timeRemaining() > 0) {
        const url = urlsToRevoke.pop();
        if (url) URL.revokeObjectURL(url);
      }
      if (urlsToRevoke.length > 0) {
        window.requestIdleCallback(revokeChunk);
      }
    };
    window.requestIdleCallback(revokeChunk);
  } else {
    // Fallback for Safari / environments without requestIdleCallback
    setTimeout(() => {
      for (const url of urlsToRevoke) {
        URL.revokeObjectURL(url);
      }
    }, 0);
  }
}

export default function PaperDetailClient({
  paperId,
  siteBase,
}: PaperDetailClientProps) {
  const { user } = useAuth();
  const trackedViewPaperIdRef = useRef<string | null>(null);
  const trackedPreviewPaperIdRef = useRef<string | null>(null);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [files, setFiles] = useState<PaperFile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<PaperStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<
    Record<string, string>
  >({});

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviting, setInviting] = useState(false);
  const [selectedStatsDays, setSelectedStatsDays] = useState<7 | 30 | 90 | 365>(
    30,
  );

  const isUploader = authors.some(
    (a) => a.userId === user?.id && a.role === "uploader",
  );

  const isAuthor = authors.some((a) => a.userId === user?.id);

  const fetchStats = useCallback(async () => {
    if (!paperId || !isAuthor) return;
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await apiFetch(
        `/api/papers/${safePath(paperId)}/stats?days=${selectedStatsDays}`,
      );
      if (res.ok) {
        const data = (await res.json()) as PaperStats;
        setStats(data);
      } else {
        setStats(null);
        setStatsError("統計情報の取得に失敗しました");
      }
    } catch {
      setStats(null);
      setStatsError("統計情報の取得に失敗しました");
    } finally {
      setStatsLoading(false);
    }
  }, [paperId, isAuthor, selectedStatsDays]);

  const fetchPaper = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/papers/${safePath(paperId)}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError("ログインが必要です");
        } else if (res.status === 403) {
          setError("この論文を閲覧する権限がありません");
        } else if (res.status === 404) {
          setError("論文が見つかりません");
        } else {
          setError("論文の取得に失敗しました");
        }
        return;
      }
      const data = await res.json();
      setPaper(data.paper);
      setFiles(data.files);
      setAuthors(data.authors);
    } catch {
      setError("論文の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  const fetchInvites = useCallback(async () => {
    if (!isUploader) return;
    try {
      const res = await apiFetch(`/api/papers/${safePath(paperId)}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites);
      }
    } catch {
      setInvites([]);
    }
  }, [paperId, isUploader]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  useEffect(() => {
    if (isUploader) fetchInvites();
  }, [isUploader, fetchInvites]);

  const trackEvent = useCallback(
    (event: "view" | "download" | "preview") => {
      if (!paper?.id) return;

      const body = JSON.stringify({
        event,
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
      });

      const trackPath = `/api/papers/${safePath(paper.id)}/track`;
      const canUseBeacon =
        paper.visibility === "public" &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function";

      if (canUseBeacon) {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
        const endpoint = `${API_BASE}${trackPath}`;
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
        return;
      }

      void apiFetch(trackPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        // Silent by design for analytics failures
      });
    },
    [paper?.id, paper?.visibility],
  );

  useEffect(() => {
    if (!paper?.id || trackedViewPaperIdRef.current === paper.id) return;
    trackedViewPaperIdRef.current = paper.id;
    trackEvent("view");
  }, [paper?.id, trackEvent]);

  useEffect(() => {
    if (!paper?.id || !isAuthor) {
      setStats(null);
      setStatsError("");
      setStatsLoading(false);
      return;
    }
    void fetchStats();
  }, [paper?.id, isAuthor, fetchStats]);

  const pdfFile = useMemo(
    () => files.find((f) => f.mimeType === "application/pdf") ?? null,
    [files],
  );
  const imageFiles = useMemo(
    () => files.filter((f) => f.mimeType?.startsWith("image/")),
    [files],
  );
  const maxDailyViewCount = useMemo(() => {
    if (!stats || stats.daily.length === 0) return 0;
    return Math.max(...stats.daily.map((entry) => entry.views));
  }, [stats]);

  useEffect(() => {
    const currentPdfFile =
      files.find((f) => f.mimeType === "application/pdf") ?? null;

    if (!currentPdfFile) {
      setPreview(null);
      setPreviewError(false);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let createdObjectUrl: string | null = null;
    const fetchPreviewUrl = async () => {
      setPreviewLoading(true);
      setPreviewError(false);

      try {
        const res = await apiFetch(
          `/api/papers/${safePath(paperId)}/files/${safePath(currentPdfFile.id)}/preview`,
        );
        if (!res.ok) {
          throw new Error("preview failed");
        }

        const data = (await res.json()) as PreviewResponse;
        let resolvedUrl = data.url;
        if (!isAbsoluteUrl(data.url)) {
          const fileRes = await apiFetch(data.url);
          if (!fileRes.ok) throw new Error("preview stream fetch failed");
          const blob = await fileRes.blob();
          resolvedUrl = URL.createObjectURL(blob);
          createdObjectUrl = resolvedUrl;
        }

        if (cancelled) return;
        setPreview({ ...data, url: resolvedUrl });
        if (trackedPreviewPaperIdRef.current !== paperId) {
          trackedPreviewPaperIdRef.current = paperId;
          trackEvent("preview");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("プレビューURLの取得に失敗しました:", err);
        setPreviewError(true);
        setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    fetchPreviewUrl();
    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [paperId, pdfFile, trackEvent]);

  useEffect(() => {
    if (imageFiles.length === 0) {
      setImagePreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const loadImages = async () => {
      const currentFailedIds: string[] = [];
      const entries = await Promise.all(
        imageFiles.map(async (img) => {
          try {
            const streamPath = `/api/papers/${safePath(paperId)}/files/${safePath(img.id)}/stream`;
            const res = await apiFetch(streamPath);
            if (!res.ok) {
              currentFailedIds.push(img.id);
              return [img.id, ""] as const;
            }
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            createdUrls.push(objectUrl);
            return [img.id, objectUrl] as const;
          } catch (err) {
            console.error(`Error loading image ${img.id}:`, err);
            currentFailedIds.push(img.id);
            return [img.id, ""] as const;
          }
        }),
      );

      if (cancelled) {
        revokeUrlsIdle(createdUrls);
        return;
      }

      setImagePreviewUrls(Object.fromEntries(entries.filter(([, url]) => url)));
      setFailedImageIds(currentFailedIds);

      if (
        entries.some(([, url]) => Boolean(url)) &&
        trackedPreviewPaperIdRef.current !== paperId
      ) {
        trackedPreviewPaperIdRef.current = paperId;
        trackEvent("preview");
      }
    };

    loadImages().catch((err) => {
      console.error("Critical error in loadImages:", err);
      if (!cancelled) {
        setImagePreviewUrls({});
        setFailedImageIds(imageFiles.map((f) => f.id));
      }
    });

    return () => {
      cancelled = true;
      revokeUrlsIdle(createdUrls);
    };
  }, [paperId, imageFiles, trackEvent]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiFetch(
        `/api/users/search?q=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleInvite = async (inviteeId: string) => {
    setInviting(true);
    try {
      const res = await apiFetch(`/api/papers/${safePath(paperId)}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId }),
      });
      if (res.ok) {
        setShowInvite(false);
        setSearchQuery("");
        setSearchResults([]);
        await fetchInvites();
        toast.success("招待を送信しました");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "招待に失敗しました");
      }
    } catch {
      toast.error("ネットワークエラーが発生しました");
    } finally {
      setInviting(false);
    }
  };

  const handleDownload = async (f: PaperFile) => {
    trackEvent("download");

    try {
      const res = await apiFetch(f.downloadUrl);
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("ログインが必要です");
        } else if (res.status === 403) {
          toast.error("このファイルをダウンロードする権限がありません");
        } else {
          toast.error("ダウンロードに失敗しました");
        }
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = f.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        window.URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("ダウンロード中にエラーが発生しました");
    }
  };

  if (loading) return <div className="text-center py-20">読み込み中...</div>;
  if (error)
    return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!paper) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "paper":
        return "📄";
      case "slides":
        return "📊";
      case "poster":
        return "🖼️";
      case "supplementary":
        return "📎";
      default:
        return "📄";
    }
  };

  const showExternalLink =
    paper.externalUrl && isValidExternalUrl(paper.externalUrl);
  const summaryViews =
    paper.showViewCount || !isAuthor
      ? paper.publicViewCount
      : (stats?.total.views ?? null);
  const summaryDownloads =
    paper.showViewCount || !isAuthor
      ? paper.publicDownloadCount
      : (stats?.total.downloads ?? null);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="flex justify-between items-start mb-2">
        <h1 className="text-2xl font-bold">{paper.title}</h1>
        {isAuthor && (
          <Link
            href={`/papers/${paper.id}/edit`}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700 shrink-0"
          >
            編集
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-6">
        {(() => {
          const badge = getVisibilityBadge(paper.visibility);
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          );
        })()}
        {paper.year && (
          <span className="flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {paper.year}年
          </span>
        )}
        {paper.venue && (
          <span className="flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {paper.venue}
          </span>
        )}
      </div>

      {(paper.showViewCount || isAuthor) && (
        <div className="mb-6 inline-flex items-end gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
              Analytics
            </p>
            <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">
              {paper.showViewCount
                ? "公開表示中の閲覧・ダウンロード数"
                : "著者向けの閲覧・ダウンロード数"}
            </p>
          </div>
          <p className="text-lg font-semibold tabular-nums">
            👁️ {summaryViews === null ? "..." : formatCount(summaryViews)} views
            {" · "}
            📥{" "}
            {summaryDownloads === null
              ? "..."
              : formatCount(summaryDownloads)}{" "}
            downloads
          </p>
        </div>
      )}

      {paper.abstract && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-1">概要</h2>
          <p className="text-sm whitespace-pre-wrap">{paper.abstract}</p>
        </div>
      )}

      {paper.description && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">
            Description
          </h2>
          <MarkdownRenderer
            markdown={paper.description}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        </section>
      )}

      {isAuthor && (
        <section className="mb-8 rounded-3xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Author Stats
              </p>
              <h2 className="mt-2 text-lg font-semibold text-gray-950 dark:text-gray-50">
                閲覧統計
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              投稿者と共著者のみ閲覧できます
            </p>
          </div>

          {statsLoading && (
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-950 dark:text-gray-400">
              統計情報を読み込み中...
            </div>
          )}

          {!statsLoading && statsError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {statsError}
            </div>
          )}

          {!statsLoading && stats && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {([7, 30, 90, 365] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSelectedStatsDays(days)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedStatsDays === days
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    {days}日
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Total Views
                  </p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                    {formatCount(stats.total.views)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Total Downloads
                  </p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                    {formatCount(stats.total.downloads)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                    Total Previews
                  </p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                    {formatCount(stats.total.previews)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    日別推移
                  </h3>
                  <p className="text-xs text-gray-500">直近{stats.days}日</p>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <div className="flex min-w-[720px] items-end gap-2">
                    {stats.daily.map((entry) => {
                      const barHeight =
                        maxDailyViewCount === 0
                          ? 4
                          : Math.max(
                              4,
                              Math.round(
                                (entry.views / maxDailyViewCount) * 120,
                              ),
                            );

                      return (
                        <div
                          key={entry.date}
                          className="flex min-w-0 flex-1 flex-col items-center gap-2"
                        >
                          <div className="flex h-32 w-full items-end">
                            <div
                              className="w-full rounded-t-xl bg-gray-900/85 dark:bg-gray-100/85"
                              style={{ height: `${barHeight}px` }}
                              title={`${entry.date}: ${entry.views} views / ${entry.downloads} downloads`}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-gray-500">
                            {entry.views}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatStatsDateLabel(entry.date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {showExternalLink && (
        <div className="mb-6">
          <a
            href={paper.externalUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 transition-colors"
          >
            <span>🔗</span>
            正式版はこちら
          </a>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <CiteButton paperId={paperId} />
      </div>

      {paper.visibility === "public" && (
        <BadgeSnippet
          paperId={paperId}
          title={paper.title}
          siteBase={siteBase}
        />
      )}

      {/* Files */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">ファイル</h2>

        {pdfFile && (
          <div className="mb-4 space-y-2">
            <h3 className="text-sm font-medium">PDFプレビュー</h3>
            {previewLoading && (
              <div className="h-[420px] animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
            )}
            {!previewLoading && preview?.url && (
              <PdfViewer
                fileUrl={preview.url}
                onDownloadFallback={() => handleDownload(pdfFile)}
              />
            )}
            {!previewLoading && previewError && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                <p>プレビューを読み込めません</p>
                <button
                  type="button"
                  className="underline"
                  onClick={() => handleDownload(pdfFile)}
                >
                  ダウンロードする
                </button>
              </div>
            )}
          </div>
        )}

        {imageFiles.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {imageFiles.map((img) => (
              <div
                key={img.id}
                className="rounded-md border border-gray-200 p-2 dark:border-gray-700"
              >
                {imagePreviewUrls[img.id] ? (
                  <img
                    src={imagePreviewUrls[img.id]}
                    alt={img.filename}
                    className="h-auto w-full rounded"
                    loading="lazy"
                  />
                ) : failedImageIds.includes(img.id) ? (
                  <div className="flex h-[180px] items-center justify-center rounded bg-red-50 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                    画像の読み込みに失敗しました
                  </div>
                ) : (
                  <div className="h-[180px] animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                )}
              </div>
            ))}
          </div>
        )}

        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl" title={f.fileType}>
                  {getFileIcon(f.fileType)}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{f.filename}</span>
                  <span className="text-xs text-gray-400">
                    {formatSize(f.sizeBytes)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(f)}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 transition-colors"
                aria-label={`${f.filename} をダウンロード`}
              >
                ダウンロード
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Authors */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">著者</h2>
        <ul className="space-y-2">
          {authors.map((a) => (
            <li
              key={a.userId}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 dark:border-gray-800 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3">
                {a.avatarUrl && (
                  <Image
                    src={a.avatarUrl}
                    alt={a.name}
                    width={28}
                    height={28}
                    className="rounded-full ring-1 ring-gray-200 dark:ring-gray-700"
                  />
                )}
                <Link
                  href={`/users/${encodeURIComponent(a.userId)}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {a.displayName ?? a.name}
                </Link>
              </div>
              {(() => {
                const badge = getRoleBadge(a.role);
                return (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </li>
          ))}
        </ul>

        {isUploader && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 共著者を招待
          </button>
        )}
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <div className="mb-6 rounded-md border border-gray-200 p-4 dark:border-gray-700">
          <h3 className="font-medium mb-2">共著者招待</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="ユーザー名で検索..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-900"
          />
          {searchResults.length > 0 && (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 rounded dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    {u.avatarUrl && (
                      <Image
                        src={u.avatarUrl}
                        alt={u.name}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    )}
                    <span>{u.displayName ?? u.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvite(u.id)}
                    disabled={inviting}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                    aria-label={`${u.displayName ?? u.name} を招待`}
                  >
                    招待
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setShowInvite(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
            className="mt-2 text-sm text-gray-500 hover:underline"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* Pending invites */}
      {isUploader && invites.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">招待状況</h2>
          <ul className="space-y-1">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between text-sm border rounded-md p-2 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {inv.inviteeName}
                  </span>
                </div>
                {(() => {
                  const badge = getInviteStatusBadge(inv.status);
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
