import Link from "next/link";
import { getVisibilityBadge } from "@/lib/presentation";
import { Paper } from "../types";

type PaperHeaderProps = {
  paper: Paper;
  isAuthor: boolean;
};

export function PaperHeader({ paper, isAuthor }: PaperHeaderProps) {
  return (
    <>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="flex justify-between items-start mb-2">
        <h1 className="text-2xl font-bold">{paper.title}</h1>
        {isAuthor && (
          <Link
            href={`/papers/${paper.id}/edit`}
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700 shrink-0"
          >
            編集
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-6">
        {(() => {
          const badge = getVisibilityBadge(paper.visibility);
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          );
        })()}
        {paper.year && (
          <span className="flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {paper.year}年
          </span>
        )}
        {paper.venue && (
          <span className="flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {paper.venue}
          </span>
        )}
      </div>
    </>
  );
}
