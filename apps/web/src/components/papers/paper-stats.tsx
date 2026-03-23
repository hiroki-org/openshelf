import React from 'react';

export type PaperStatsData = {
  totalViews: number;
  last7DaysViews: number;
  last30DaysViews: number;
  dailyViews: Array<{
    date: string;
    count: number;
  }>;
};

type PaperStatsProps = {
  stats: PaperStatsData;
  statsLoading: boolean;
  statsError: string;
  maxDailyViewCount: number;
};

function formatStatsDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function PaperStats({ stats, statsLoading, statsError, maxDailyViewCount }: PaperStatsProps) {
  return (
    <section className="mb-8 rounded-3xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
            Author Stats
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-950 dark:text-gray-50">
            閲覧統計
          </h2>
        </div>
        <p className="text-xs text-gray-500">
          投稿者と共著者のみ閲覧できます
        </p>
      </div>

      {statsLoading && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-950 dark:text-gray-400">
          統計情報を読み込み中...
        </div>
      )}

      {!statsLoading && statsError && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {statsError}
        </div>
      )}

      {!statsLoading && stats && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Total
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                {stats.totalViews}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Last 7 Days
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                {stats.last7DaysViews}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                Last 30 Days
              </p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-950 dark:text-gray-50">
                {stats.last30DaysViews}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-950">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                日別推移
              </h3>
              <p className="text-xs text-gray-500">直近30日</p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="flex min-w-[720px] items-end gap-2">
                {stats.dailyViews.map((entry) => {
                  const barHeight =
                    maxDailyViewCount === 0
                      ? 4
                      : Math.max(
                          4,
                          Math.round((entry.count / maxDailyViewCount) * 120),
                        );

                  return (
                    <div
                      key={entry.date}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2"
                    >
                      <div className="flex h-32 w-full items-end">
                        <div
                          className="w-full rounded-t-xl bg-gray-900/85 dark:bg-gray-100/85"
                          style={{ height: `${barHeight}px` }}
                          title={`${entry.date}: ${entry.count}`}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-gray-500">
                        {entry.count}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatStatsDateLabel(entry.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
