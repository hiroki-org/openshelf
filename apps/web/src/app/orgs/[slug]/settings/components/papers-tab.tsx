import { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { OrgPaper } from "./types";

export function PapersTab({
  orgPapers,
  slug,
  fetchData,
}: {
  orgPapers: OrgPaper[];
  slug: string;
  fetchData: () => Promise<void>;
}) {
  const [paperSearch, setPaperSearch] = useState("");
  const [paperSearchResults, setPaperSearchResults] = useState<
    { id: string; title: string }[]
  >([]);
  const [addingPaper, setAddingPaper] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paperSearchRef = useRef(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handlePaperSearch = (q: string) => {
    setPaperSearch(q);
    setError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (q.length < 2) {
      setPaperSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const requestId = ++paperSearchRef.current;
      try {
        const res = await apiFetch(`/api/papers?q=${encodeURIComponent(q)}&visibility=public`);
        if (paperSearchRef.current !== requestId) return;
        if (res.ok) {
          const data = await res.json();
          const existingIds = new Set(orgPapers.map((p) => p.id));
          setPaperSearchResults(
            data.papers.filter((p: { id: string }) => !existingIds.has(p.id)),
          );
        }
      } catch {
        if (paperSearchRef.current !== requestId) return;
        setPaperSearchResults([]);
      }
    }, 300);
  };

  const handleAddPaper = async (paperId: string) => {
    setError(null);
    setAddingPaper(true);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/papers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId }),
        },
      );
      if (res.ok) {
        setPaperSearch("");
        setPaperSearchResults([]);
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error ?? "追加に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    } finally {
      setAddingPaper(false);
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    if (!confirm("この論文の紐づけを解除しますか？")) return;
    setError(null);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/papers/${encodeURIComponent(paperId)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error ?? "解除に失敗しました");
      }
    } catch {
      setError("ネットワークエラー");
    }
  };

  return (
    <div>
      {/* Add paper form */}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
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
