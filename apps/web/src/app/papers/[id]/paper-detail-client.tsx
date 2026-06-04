"use client";

import { useAuth } from "@/components/auth-provider";
import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { safePath } from "@/lib/sanitization";
import { CiteButton } from "./cite-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { BadgeSnippet } from "./badge-snippet";
import { PaperHeader } from "./components/paper-header";
import { PaperAnalyticsSummary } from "./components/paper-analytics-summary";
import { PaperStatsSection } from "./components/paper-stats-section";
import { PaperFilesList } from "./components/paper-files-list";
import { PaperAuthorsList } from "./components/paper-authors-list";
import { PaperInviteDialog } from "./components/paper-invite-dialog";
import { PaperPendingInvites } from "./components/paper-pending-invites";
import {
  Paper,
  PaperFile,
  Author,
  Invite,
  SearchUser,
  PreviewResponse,
  PaperStats,
} from "./types";

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
  const [inviting, setInviting] = useState<string | null>(null);
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
          setError("この成果物を閲覧する権限がありません");
        } else if (res.status === 404) {
          setError("成果物が見つかりません");
        } else {
          setError("成果物の取得に失敗しました");
        }
        return;
      }
      const data = await res.json();
      setPaper(data.paper);
      setFiles(data.files);
      setAuthors(data.authors);
    } catch {
      setError("成果物の取得に失敗しました");
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
    setInviting(inviteeId);
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
      setInviting(null);
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

  return (
    <div className="max-w-3xl">
      <PaperHeader paper={paper} isAuthor={isAuthor} />

      <PaperAnalyticsSummary
        paper={paper}
        isAuthor={isAuthor}
        stats={stats}
        formatCount={formatCount}
      />

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
        <PaperStatsSection
          stats={stats}
          statsLoading={statsLoading}
          statsError={statsError}
          selectedStatsDays={selectedStatsDays}
          setSelectedStatsDays={setSelectedStatsDays}
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

      <PaperFilesList
        pdfFile={pdfFile}
        previewLoading={previewLoading}
        preview={preview}
        previewError={previewError}
        imageFiles={imageFiles}
        imagePreviewUrls={imagePreviewUrls}
        failedImageIds={failedImageIds}
        files={files}
        handleDownload={handleDownload}
        formatSize={formatSize}
        getFileIcon={getFileIcon}
      />

      <PaperAuthorsList
        authors={authors}
        isUploader={isUploader}
        paperTitle={paper.title}
        setShowInvite={setShowInvite}
      />

      <PaperInviteDialog
        showInvite={showInvite}
        setShowInvite={setShowInvite}
        searchQuery={searchQuery}
        handleSearch={handleSearch}
        searchResults={searchResults}
        handleInvite={handleInvite}
        inviting={inviting}
        setSearchQuery={setSearchQuery}
        setSearchResults={setSearchResults}
      />

      <PaperPendingInvites isUploader={isUploader} invites={invites} />
    </div>
  );
}
