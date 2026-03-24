import Link from "next/link";
import { Org } from "../types";

type OrgHeaderProps = {
  org: Org;
    memberCount: number;
  paperCount: number;
  collectionCount: number;
  isAdmin: boolean;
};

export function OrgHeader({
  org,
    memberCount,
  paperCount,
  collectionCount,
  isAdmin,
}: OrgHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-gray-500 mt-1">@{org.slug}</p>
          {org.description && (
            <p className="text-sm text-gray-600 mt-2 dark:text-gray-400">
              {org.description}
            </p>
          )}
        </div>
        {isAdmin && (
          <Link
            href={`/orgs/${org.slug}/settings`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            ⚙ 設定
          </Link>
        )}
      </div>
      <div className="flex gap-4 mt-4 text-sm text-gray-500">
        <span>👥 {memberCount} メンバー</span>
        <span>📄 {paperCount} 論文</span>
        <span>📚 {collectionCount} コレクション</span>
      </div>
    </div>
  );
}
