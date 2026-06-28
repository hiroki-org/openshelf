"use client";

import { useMemo, useRef } from "react";
import { MarkdownRenderer } from "./markdown-renderer";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  mode: "write" | "preview";
  onModeChange: (mode: "write" | "preview") => void;
  id?: string;
  placeholder?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  mode,
  onModeChange,
  id = "markdown-editor",
  placeholder,
}: MarkdownEditorProps) {
  const previewText = useMemo(() => value.trim(), [value]);
  const writeTabRef = useRef<HTMLButtonElement>(null);
  const previewTabRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-700">
      <div
        className="flex border-b border-gray-300 dark:border-gray-700"
        role="tablist"
        aria-label="Markdown editor mode"
        onKeyDown={(e) => {
          if (
            e.key !== "ArrowLeft" &&
            e.key !== "ArrowRight" &&
            e.key !== "Home" &&
            e.key !== "End"
          ) {
            return;
          }

          e.preventDefault();

          let nextMode: "write" | "preview";
          if (e.key === "Home") {
            nextMode = "write";
          } else if (e.key === "End") {
            nextMode = "preview";
          } else {
            nextMode = mode === "write" ? "preview" : "write";
          }

          onModeChange(nextMode);
          if (nextMode === "write") {
            writeTabRef.current?.focus();
          } else {
            previewTabRef.current?.focus();
          }
        }}
      >
        <button
          ref={writeTabRef}
          id={`${id}-tab-write`}
          type="button"
          role="tab"
          aria-selected={mode === "write"}
          aria-controls={`${id}-panel-write`}
          tabIndex={mode === "write" ? 0 : -1}
          onClick={() => onModeChange("write")}
          className={`px-3 py-2 text-sm ${mode === "write" ? "bg-gray-100 font-medium dark:bg-gray-800" : ""}`}
        >
          Write
        </button>
        <button
          ref={previewTabRef}
          id={`${id}-tab-preview`}
          type="button"
          role="tab"
          aria-selected={mode === "preview"}
          aria-controls={`${id}-panel-preview`}
          tabIndex={mode === "preview" ? 0 : -1}
          onClick={() => onModeChange("preview")}
          className={`px-3 py-2 text-sm ${mode === "preview" ? "bg-gray-100 font-medium dark:bg-gray-800" : ""}`}
        >
          Preview
        </button>
      </div>
      {mode === "write" ? (
        <div
          role="tabpanel"
          id={`${id}-panel-write`}
          aria-labelledby={`${id}-tab-write`}
        >
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className="w-full resize-y border-0 bg-transparent p-3 font-mono text-sm focus:outline-none"
            placeholder={placeholder}
          />
        </div>
      ) : (
        <div
          className="min-h-[12rem] p-3"
          role="tabpanel"
          id={`${id}-panel-preview`}
          aria-labelledby={`${id}-tab-preview`}
        >
          {previewText ? (
            <MarkdownRenderer
              markdown={previewText}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
          ) : (
            <p className="text-sm text-gray-500">
              プレビューする内容がありません
            </p>
          )}
        </div>
      )}
    </div>
  );
}
