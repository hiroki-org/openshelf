"use client";

import { toast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { safePath } from "@/lib/sanitization";
import { useEffect, useRef, useState } from "react";

type CitationFormat = "bibtex" | "biblatex" | "apa" | "ieee" | "mla" | "plain";

const FORMAT_LABELS: Array<{ value: CitationFormat; label: string }> = [
  { value: "bibtex", label: "BibTeX" },
  { value: "biblatex", label: "BibLaTeX" },
  { value: "apa", label: "APA" },
  { value: "ieee", label: "IEEE" },
  { value: "mla", label: "MLA" },
  { value: "plain", label: "Plain Text" },
];

type CiteButtonProps = {
  paperId: string;
};

export function CiteButton({ paperId }: CiteButtonProps) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<CitationFormat | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleCopy = async (format: CitationFormat) => {
    setLoadingFormat(format);
    try {
      const res = await apiFetch(
        `/api/papers/${safePath(paperId)}/cite?format=${format}`,
      );
      if (!res.ok) {
        toast.error("引用の生成に失敗しました");
        return;
      }
      const data = (await res.json()) as { citation?: string };
      if (!data.citation) {
        toast.error("引用の生成に失敗しました");
        return;
      }
      if (!navigator.clipboard?.writeText) {
        toast.error("このブラウザではクリップボード機能を利用できません");
        return;
      }
      try {
        await navigator.clipboard.writeText(data.citation);
      } catch {
        toast.error("クリップボードへのコピーに失敗しました");
        return;
      }
      toast.success("コピーしました");
      setOpen(false);
    } catch {
      toast.error("引用の生成に失敗しました");
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <div className="mb-6 relative inline-block" ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span>📋 Cite</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          role="menu"
        >
          {FORMAT_LABELS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800"
              onClick={() => handleCopy(option.value)}
              disabled={loadingFormat !== null}
              role="menuitem"
            >
              <span>{loadingFormat === option.value ? "生成中..." : option.label}</span>
              {loadingFormat === option.value && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent ml-2"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
