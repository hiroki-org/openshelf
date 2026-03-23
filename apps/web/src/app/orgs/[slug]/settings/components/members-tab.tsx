import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import type { User } from "@/components/auth-provider";
import type { Member, SearchUser } from "../types";

export function MembersTab({
  members,
  slug,
  fetchData,
  user,
}: {
  members: Member[];
  slug: string;
  fetchData: () => Promise<void>;
  user: User | null;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userSearchRef = useRef(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleUserSearch = (q: string) => {
    setError(null);
    setSearchQuery(q);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const requestId = ++userSearchRef.current;
      try {
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (userSearchRef.current !== requestId) return;
        if (res.ok) {
          const data = await res.json();
          const existingIds = new Set(members.map((m) => m.userId));
          setSearchResults(
            data.users.filter((u: SearchUser) => !existingIds.has(u.id)),
          );
        }
      } catch {
        if (userSearchRef.current !== requestId) return;
        setSearchResults([]);
      }
    }, 300);
  };

  const handleAddMember = async (userId: string, role: string = "member") => {
    setError(null);
    setInviting(true);
    try {
      const res = await apiFetch(`/api/orgs/${encodeURIComponent(slug)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error ?? "追加に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setError(null);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error ?? "変更に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    setError(null);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error ?? "削除に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    }
  };

  return (
    <div>
      {/* Invite form */}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2">メンバーを追加</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleUserSearch(e.target.value)}
          placeholder="ユーザー名またはGitHub IDで検索..."
          aria-label="メンバー検索"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-900"
        />
        {searchResults.length > 0 && (
          <ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md dark:border-gray-700">
            {searchResults.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
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
                  onClick={() => handleAddMember(u.id)}
                  disabled={inviting}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  追加
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Member list */}
      <h3 className="text-sm font-medium mb-2">メンバー一覧</h3>
      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              {m.avatarUrl && (
                <Image
                  src={m.avatarUrl}
                  alt={m.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{m.displayName ?? m.name}</span>
              <span className="text-xs text-gray-400">@{m.githubId}</span>
            </div>
            <div className="flex items-center gap-2">
              {m.role === "owner" ? (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  owner
                </span>
              ) : (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                    disabled={m.userId === user?.id}
                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                  {m.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      削除
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
