import Link from "next/link";
import { getVisibilityBadge } from "@/lib/presentation";
import { Collection } from "../types";

type CollectionListProps = {
  collections: Collection[];
  slug: string;
  isAdmin: boolean;
};

export function CollectionList({
  collections,
  slug,
  isAdmin,
}: CollectionListProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">コレクション</h2>
        {isAdmin && (
          <Link
            href="/collections/new"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 新規作成
          </Link>
        )}
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-gray-500">コレクションがありません</p>
      ) : (
        <ul className="space-y-2">
          {collections.map((c) => {
            const badge = getVisibilityBadge(c.visibility);
            return (
              <li key={c.id}>
                <Link
                  href={`/orgs/${slug}/c/${c.slug}`}
                  className="block rounded-md border p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-medium">{c.name}</h3>
                      {c.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {c.description}
                        </p>
                      )}
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
