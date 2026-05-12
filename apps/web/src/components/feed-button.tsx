"use client";

import { toast } from "@/components/toast";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type FeedButtonProps = {
  url: string;
  className?: string;
  label?: string;
};

export function FeedButton({
  url,
  className = "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800",
  label = "📡 Feed",
}: FeedButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    open,
    setOpen,
    containerRef,
    triggerRef,
    dialogRef,
  });

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      toast.error("このブラウザではクリップボード機能を利用できません");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("コピーしました");
    } catch {
      toast.error("クリップボードへのコピーに失敗しました");
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="フィード URL"
          tabIndex={-1}
          className="absolute right-0 top-full z-20 mt-2 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            フィード URL
          </p>
          <textarea
            readOnly
            aria-label="フィード URL"
            value={url}
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              onClick={handleCopy}
            >
              コピー
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              開く
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
