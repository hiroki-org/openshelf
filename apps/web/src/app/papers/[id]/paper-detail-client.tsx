"use client";

import { useAuth } from "@/components/auth-provider";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { safePath } from "@/lib/sanitization";
import {
  getVisibilityBadge,
} from "@/lib/presentation";

import { PaperStats, type PaperStatsData } from "@/components/papers/paper-stats";
import { PaperFiles, type PaperFile, type PreviewResponse } from "@/components/papers/paper-files";
import { PaperAuthors, type Author } from "@/components/papers/paper-authors";
import { PaperInvites, type Invite, type SearchUser } from "@/components/papers/paper-invites";


type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
  showViewCount: boolean;
  publicViewCount: number | null;
  externalUrl: string | null;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
};






const PPT_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const isPptMimeType = (
  mimeType: string | null,
): mimeType is (typeof PPT_MIME_TYPES)[number] => mimeType === PPT_MIME_TYPES[0];


const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const STATS_FETCH_ERROR_MESSAGE = "統計情報の取得に失敗しました";

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
};


export default function PaperDetailClient({ paperId }: PaperDetailClientProps) {
  const { user } = useAuth();
  const trackedViewPaperIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const [paper, setPaper] = useState<Paper | null>(null);
  const [files, setFiles] = useState<PaperFile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stats, setStats] = useState<PaperStatsData | null>(null);
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

  const isUploader = authors.some(
    (a) => a.userId === user?.id && a.role === "uploader",
  );

  const isAuthor = authors.some((a) => a.userId === user?.id);

  const fetchStats = useCallback(
    async (options?: { withLoading?: boolean; isCancelled?: () => boolean }) => {
      if (!paperId || !isAuthor) return;

      const canUpdateState =
        typeof options?.isCancelled === "function"
          ? () => mountedRef.current && !options.isCancelled?.()
          : () => mountedRef.current;

      if (options?.withLoading ?? true) {
        if (canUpdateState()) setStatsLoading(true);
      }
      if (canUpdateState()) setStatsError("");

      try {
        const res = await apiFetch(`/api/papers/${safePath(paperId)}/stats`);

        if (!res.ok) {
          if (!canUpdateState()) return;
          setStats(null);
          if (res.status === 401) {
            setStatsError("統計情報を取得するにはログインが必要です");
          } else if (res.status === 403) {
            setStatsError("統計情報を閲覧する権限がありません");
          } else if (res.status === 404) {
            setStatsError("統計情報が見つかりません");
          } else {
            setStatsError(STATS_FETCH_ERROR_MESSAGE);
          }
          return;
        }

        const data = (await res.json()) as PaperStatsData;
        if (!canUpdateState()) return;

        setStats(data);
        setStatsError("");
      } catch {
        if (!canUpdateState()) return;
        setStats(null);
        setStatsError(STATS_FETCH_ERROR_MESSAGE);
      } finally {
        if (canUpdateState()) setStatsLoading(false);
      }
    },
    [paperId, isAuthor],
  );

  const applyCountedView = useCallback(() => {
    setPaper((current) => {
      if (!current || !current.showViewCount) return current;
      return {
        ...current,
        publicViewCount: (current.publicViewCount ?? 0) + 1,
      };
    });

    // Refresh full stats after a recorded view to ensure consistency
    void fetchStats({ withLoading: false });
  }, [fetchStats]);

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
      const res = await apiFetch(
        `/api/papers/${safePath(paperId)}/invites`,
      );
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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!paper?.id || trackedViewPaperIdRef.current === paper.id) return;

    trackedViewPaperIdRef.current = paper.id;
    let cancelled = false;

    const recordView = async () => {
      try {
        const res = await apiFetch(`/api/papers/${safePath(paper.id)}/view`, {
          method: "POST",
        });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { counted?: boolean };
        if (data.counted) {
          applyCountedView();
        }
      } catch {
        // Viewing the paper should still succeed even if analytics fails.
      }
    };

    void recordView();

    return () => {
      cancelled = true;
    };
  }, [paper?.id, applyCountedView]);

  useEffect(() => {
    if (!paper?.id || !isAuthor) {
      setStats(null);
      setStatsError("");
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    void fetchStats({ isCancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [paper?.id, isAuthor, fetchStats]);

  const pdfFile = useMemo(
    () => files.find((f) => f.mimeType === "application/pdf") ?? null,
    [files],
  );
  const imageFiles = useMemo(
    () => files.filter((f) => f.mimeType?.startsWith("image/")),
    [files],
  );
  const pptxFile = useMemo(
    () => files.find((f) => isPptMimeType(f.mimeType)) ?? null,
    [files],
  );
  const maxDailyViewCount = useMemo(() => {
    if (!stats || stats.dailyViews.length === 0) return 0;
    return Math.max(...stats.dailyViews.map((entry) => entry.count));
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
  }, [paperId, pdfFile]);

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
        for (const url of createdUrls) URL.revokeObjectURL(url);
        return;
      }

      setImagePreviewUrls(Object.fromEntries(entries.filter(([, url]) => url)));
      setFailedImageIds(currentFailedIds);
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
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [paperId, imageFiles]);

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
      const res = await apiFetch(
        `/api/papers/${safePath(paperId)}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteeId }),
        },
      );
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

  const showExternalLink =
    paper.externalUrl && isValidExternalUrl(paper.externalUrl);

  return (
    <div className="max-w-3xl">
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

      {paper.showViewCount && (
        <div className="mb-6 inline-flex items-end gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
              Views
            </p>
            <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">
              公開表示中の総閲覧数
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums">
            {paper.publicViewCount ?? 0}
          </p>
        </div>
      )}

      {paper.abstract && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-1">概要</h2>
          <p className="text-sm whitespace-pre-wrap">{paper.abstract}</p>
        </div>
      )}

      {isAuthor && (
        <PaperStats
          stats={stats}
          statsLoading={statsLoading}
          statsError={statsError}
          maxDailyViewCount={maxDailyViewCount}
        />
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

      {/* Files */}
      <PaperFiles
        files={files}
        pdfFile={pdfFile}
        pptxFile={pptxFile}
        imageFiles={imageFiles}
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        imagePreviewUrls={imagePreviewUrls}
        failedImageIds={failedImageIds}
        handleDownload={handleDownload}
      />

      {/* Authors */}
      <PaperAuthors
        authors={authors}
        isUploader={isUploader}
        showInvite={showInvite}
        setShowInvite={setShowInvite}
      />

      {/* Invite dialog and Pending invites */}
      <PaperInvites
        isUploader={isUploader}
        showInvite={showInvite}
        setShowInvite={setShowInvite}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        setSearchResults={setSearchResults}
        inviting={inviting}
        handleSearch={handleSearch}
        handleInvite={handleInvite}
        invites={invites}
      />
    </div>
  );
}
