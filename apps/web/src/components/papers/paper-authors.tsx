import Image from 'next/image';
import { getRoleBadge } from '@/lib/presentation';

export type Author = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type PaperAuthorsProps = {
  authors: Author[];
  isUploader: boolean;
  showInvite: boolean;
  setShowInvite: (show: boolean) => void;
};

export function PaperAuthors({ authors, isUploader, showInvite, setShowInvite }: PaperAuthorsProps) {
  if (authors.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-gray-500 mb-2">著者</h2>
      <ul className="space-y-2">
        {authors.map((a) => {
          const badge = getRoleBadge(a.role);
          return (
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
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {a.displayName ?? a.name}
                </span>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
              >
                {badge.label}
              </span>
            </li>
          );
        })}
      </ul>

      {isUploader && !showInvite && (
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          + 共著者を招待
        </button>
      )}
    </div>
  );
}
