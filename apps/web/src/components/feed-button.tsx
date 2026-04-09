"use client";

import { toast } from "@/components/toast";
import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (!open) return;

    const focusableSelector =
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
          [],
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true",
      );

    const firstFocusable = getFocusableElements()[0];
    (firstFocusable ?? dialogRef.current)?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !containerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        return;
      }

      const activeElement = document.activeElement;
      if (event.shiftKey) {
        if (activeElement === first || activeElement === dialogRef.current) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
