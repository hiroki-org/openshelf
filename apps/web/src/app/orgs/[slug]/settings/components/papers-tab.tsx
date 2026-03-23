"use client";

import { OrgPaper } from "../types";

export function PapersTab({
  paperSearch,
  handlePaperSearch,
  paperSearchResults,
  handleAddPaper,
  addingPaper,
  orgPapers,
  handleRemovePaper,
}: {
  paperSearch: string;
  handlePaperSearch: (q: string) => Promise<void>;
  paperSearchResults: { id: string; title: string }[];
  handleAddPaper: (paperId: string) => Promise<void>;
  addingPaper: boolean;
  orgPapers: OrgPaper[];
  handleRemovePaper: (paperId: string) => Promise<void>;
}) {
  return (
    <div>
      {/* Add paper form */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2">論文を追加</h3>
        <input
          type="text"
          value={paperSearch}
          onChange={(e) => handlePaperSearch(e.target.value)}
          placeholder="論文タイトルで検索..."
          aria-label="論文検索"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-900"
        />
        {paperSearchResults.length > 0 && (
          <ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md dark:border-gray-700">
            {paperSearchResults.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="truncate">{p.title}</span>
                <button
                  type="button"
                  onClick={() => handleAddPaper(p.id)}
                  disabled={addingPaper}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50 shrink-0"
                >
                  追加
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Paper list */}
      <h3 className="text-sm font-medium mb-2">紐づけ済み論文</h3>
      {orgPapers.length === 0 ? (
        <p className="text-sm text-gray-500">まだ論文がありません</p>
      ) : (
        <ul className="space-y-2">
          {orgPapers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700"
            >
              <span className="truncate flex-1 min-w-0">{p.title}</span>
              <button
                type="button"
                onClick={() => handleRemovePaper(p.id)}
                className="text-red-500 hover:text-red-700 text-xs shrink-0 ml-2"
              >
                解除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
