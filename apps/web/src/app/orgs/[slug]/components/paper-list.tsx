import Link from "next/link";
import { getVisibilityBadge } from "@/lib/presentation";
import { OrgPaper } from "../types";

type PaperListProps = {
  papers: OrgPaper[];
  slug: string;
  isAdmin: boolean;
};

export function PaperList({ papers, slug, isAdmin }: PaperListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">論文</h2>
        {isAdmin && (
          <Link
            href={`/orgs/${slug}/settings?tab=papers`}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 論文を追加
          </Link>
        )}
      </div>

      {papers.length === 0 ? (
        <p className="text-sm text-gray-500">まだ論文がありません</p>
      ) : (
        <ul className="space-y-3">
          {papers.map((p) => {
            const badge = getVisibilityBadge(p.visibility);
            return (
              <li key={p.id}>
                <Link
                  href={`/papers/${p.id}`}
                  className="block rounded-md border p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {p.title}
                      </h3>
                      {p.abstract && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {p.abstract}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                        {p.year && <span>{p.year}年</span>}
                        {p.venue && <span>{p.venue}</span>}
                        {p.category && <span>{p.category}</span>}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
