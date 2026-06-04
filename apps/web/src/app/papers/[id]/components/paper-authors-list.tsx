import Image from "next/image";
import Link from "next/link";
import { getRoleBadge } from "@/lib/presentation";
import { Author } from "../types";

type PaperAuthorsListProps = {
  authors: Author[];
  isUploader: boolean;
  paperTitle: string;
  setShowInvite: (show: boolean) => void;
};

export function PaperAuthorsList({
  authors,
  isUploader,
  paperTitle,
  setShowInvite,
}: PaperAuthorsListProps) {
  return (
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
          aria-label={`${paperTitle}に共著者を招待`}
          className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          + 共著者を招待
        </button>
      )}
    </div>
  );
}
