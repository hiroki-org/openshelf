import React from 'react';
import Image from 'next/image';
import { getInviteStatusBadge } from '@/lib/presentation';

export type Invite = {
  id: string;
  inviteeId: string | null;
  inviteeName: string;
  status: string;
  createdAt: string;
};

export type SearchUser = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type PaperInvitesProps = {
  isUploader: boolean;
  showInvite: boolean;
  setShowInvite: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchUser[];
  setSearchResults: (results: SearchUser[]) => void;
  inviting: boolean;
  handleSearch: (q: string) => Promise<void>;
  handleInvite: (inviteeId: string) => Promise<void>;
  invites: Invite[];
};

export function PaperInvites({
  isUploader,
  showInvite,
  setShowInvite,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  inviting,
  handleSearch,
  handleInvite,
  invites,
}: PaperInvitesProps) {
  if (!isUploader) return null;

  return (
    <>
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

      {invites.length > 0 && (
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
    </>
  );
}
