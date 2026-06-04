import Image from "next/image";
import { SearchUser } from "../types";

type PaperInviteDialogProps = {
  showInvite: boolean;
  setShowInvite: (show: boolean) => void;
  searchQuery: string;
  handleSearch: (q: string) => void;
  searchResults: SearchUser[];
  handleInvite: (userId: string) => void;
  inviting: string | null;
  setSearchQuery: (q: string) => void;
  setSearchResults: (results: SearchUser[]) => void;
};

export function PaperInviteDialog({
  showInvite,
  setShowInvite,
  searchQuery,
  handleSearch,
  searchResults,
  handleInvite,
  inviting,
  setSearchQuery,
  setSearchResults,
}: PaperInviteDialogProps) {
  if (!showInvite) return null;

  return (
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
                disabled={inviting !== null}
                aria-busy={inviting === u.id}
                aria-label={`${u.displayName ?? u.name}を共著者として招待`}
                className="inline-flex min-w-[72px] items-center justify-center rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {inviting === u.id ? (
                  <span className="flex items-center justify-center gap-1">
                    <span
                      className="h-3 w-3 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    招待中...
                  </span>
                ) : (
                  "招待"
                )}
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
  );
}
