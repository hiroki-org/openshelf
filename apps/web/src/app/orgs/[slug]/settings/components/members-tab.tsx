"use client";

import Image from "next/image";
import { Member, SearchUser } from "../types";

export function MembersTab({
  searchQuery,
  handleUserSearch,
  searchResults,
  handleAddMember,
  inviting,
  members,
  user,
  handleChangeRole,
  handleRemoveMember,
}: {
  searchQuery: string;
  handleUserSearch: (q: string) => Promise<void>;
  searchResults: SearchUser[];
  handleAddMember: (userId: string, role?: string) => Promise<void>;
  inviting: boolean;
  members: Member[];
  user: { id: string } | null;
  handleChangeRole: (userId: string, newRole: string) => Promise<void>;
  handleRemoveMember: (userId: string) => Promise<void>;
}) {
  return (
    <div>
      {/* Invite form */}
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
              <select
                value={m.role === "owner" ? "admin" : m.role}
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
