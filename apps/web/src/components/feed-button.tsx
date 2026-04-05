"use client";

import { toast } from "@/components/toast";

type FeedButtonProps = {
  url: string;
  className?: string;
  label?: string;
};

export function FeedButton({
  url,
  className = "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800",
  label = "📡 RSS",
}: FeedButtonProps) {
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
    <button type="button" className={className} onClick={handleCopy}>
      {label}
    </button>
  );
}
