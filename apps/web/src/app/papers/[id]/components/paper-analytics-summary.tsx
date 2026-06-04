import { Paper, PaperStats } from "../types";

type PaperAnalyticsSummaryProps = {
  paper: Paper;
  isAuthor: boolean;
  stats: PaperStats | null;
  formatCount: (value: number | null | undefined) => string;
};

export function PaperAnalyticsSummary({
  paper,
  isAuthor,
  stats,
  formatCount,
}: PaperAnalyticsSummaryProps) {
  if (!paper.showViewCount && !isAuthor) return null;

  const summaryViews =
    paper.showViewCount || !isAuthor
      ? paper.publicViewCount
      : (stats?.total.views ?? null);
  const summaryDownloads =
    paper.showViewCount || !isAuthor
      ? paper.publicDownloadCount
      : (stats?.total.downloads ?? null);

  return (
    <div className="mb-6 inline-flex items-end gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
          Analytics
        </p>
        <p className="mt-1 text-sm text-blue-800/80 dark:text-blue-200/80">
          {paper.showViewCount
            ? "公開表示中の閲覧・ダウンロード数"
            : "著者向けの閲覧・ダウンロード数"}
        </p>
      </div>
      <p className="text-lg font-semibold tabular-nums">
        👁️ {summaryViews === null ? "..." : formatCount(summaryViews)} views
        {" · "}
        📥 {summaryDownloads === null
          ? "..."
          : formatCount(summaryDownloads)}{" "}
        downloads
      </p>
    </div>
  );
}
