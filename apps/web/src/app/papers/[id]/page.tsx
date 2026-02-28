"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
};

type PaperFile = {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  mimeType: string | null;
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
    const res = await fetch(`/api/papers/${paperId}`, {
      credentials: "include",
    });
    if (!res.ok) {
      setError("論文が見つかりません");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPaper(data.paper);
    setFiles(data.files);
    setAuthors(data.authors);
    setLoading(false);
  }, [paperId]);

  const fetchInvites = useCallback(async () => {
    if (!isUploader) return;
    const res = await fetch(`/api/papers/${paperId}/invites`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites);
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
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.users);
    }
  };

  const handleInvite = async (inviteeId: string) => {
    setInviting(true);
    const res = await fetch(`/api/papers/${paperId}/invites`, {
      method: "POST",
      credentials: "include",
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
    setInviting(false);
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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">{paper.title}</h1>

      <div className="flex gap-2 text-sm text-gray-500 mb-4">
        <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
          {paper.visibility}
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

      {/* Files */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">ファイル</h2>
        <ul className="space-y-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between text-sm border rounded-md p-2 dark:border-gray-700"
            >
              <span>
                {f.filename}{" "}
                <span className="text-xs text-gray-400">({f.fileType})</span>
              </span>
              <span className="text-xs text-gray-400">
                {formatSize(f.sizeBytes)}
              </span>
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
