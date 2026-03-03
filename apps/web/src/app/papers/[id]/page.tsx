"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
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
const isValidExternalUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  const { user } = useAuth();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [files, setFiles] = useState<PaperFile[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviting, setInviting] = useState(false);

  const isUploader = authors.some(
    (a) => a.userId === user?.id && a.role === "uploader",
  );

  const fetchPaper = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/papers/${paperId}`);
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
      const res = await apiFetch(`/api/papers/${paperId}/invites`);
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
      const res = await apiFetch(`/api/papers/${paperId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId }),
      });
      if (res.ok) {
        setShowInvite(false);
        setSearchQuery("");
        setSearchResults([]);
        await fetchInvites();
      } else {
        const data = await res.json();
        alert(data.error ?? "招待に失敗しました");
      }
    } catch {
      alert("ネットワークエラーが発生しました");
    } finally {
      setInviting(false);
    }
  };

  const handleDownload = async (f: PaperFile) => {
    try {
      const res = await apiFetch(f.downloadUrl);
      if (!res.ok) {
        if (res.status === 401) {
          alert("ログインが必要です");
        } else if (res.status === 403) {
          alert("このファイルをダウンロードする権限がありません");
        } else {
          alert("ダウンロードに失敗しました");
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
      alert("ダウンロード中にエラーが発生しました");
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

  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case "public":
        return {
          label: "公開",
          className:
            "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        };
      case "org_only":
        return {
          label: "組織限定",
          className:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
        };
      case "private":
        return {
          label: "非公開",
          className:
            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        };
      default:
        return {
          label: visibility,
          className: "bg-gray-100 text-gray-700 dark:bg-gray-800",
        };
    }
  };

  const visibilityBadge = getVisibilityBadge(paper.visibility);
  const showExternalLink = paper.externalUrl && isValidExternalUrl(paper.externalUrl);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">{paper.title}</h1>

      <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
        <span className={`rounded px-2 py-0.5 ${visibilityBadge.className}`}>
          {visibilityBadge.label}
        </span>
        {paper.year && <span>{paper.year}年</span>}
        {paper.venue && <span>/ {paper.venue}</span>}
        {paper.category && <span>/ {paper.category}</span>}
      </div>

      {paper.abstract && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-1">概要</h2>
          <p className="text-sm whitespace-pre-wrap">{paper.abstract}</p>
        </div>
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
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">ファイル</h2>
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
            <li key={a.userId} className="flex items-center gap-2 text-sm">
              {a.avatarUrl && (
                <Image
                  src={a.avatarUrl}
                  alt={a.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{a.displayName ?? a.name}</span>
              <span className="text-xs text-gray-400 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
                {a.role}
              </span>
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
                <span>{inv.inviteeName}</span>
                <span
                  className={`text-xs rounded px-1.5 py-0.5 ${
                    inv.status === "pending"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      : inv.status === "accepted"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
