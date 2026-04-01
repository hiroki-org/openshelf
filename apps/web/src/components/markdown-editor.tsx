"use client";

import { useMemo } from "react";
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

  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-700">
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        <button
          type="button"
          onClick={() => onModeChange("write")}
          className={`px-3 py-2 text-sm ${mode === "write" ? "bg-gray-100 font-medium dark:bg-gray-800" : ""}`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => onModeChange("preview")}
          className={`px-3 py-2 text-sm ${mode === "preview" ? "bg-gray-100 font-medium dark:bg-gray-800" : ""}`}
        >
          Preview
        </button>
      </div>
      {mode === "write" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full resize-y border-0 bg-transparent p-3 font-mono text-sm focus:outline-none"
          placeholder={placeholder}
        />
      ) : (
        <div className="min-h-[12rem] p-3">
          {previewText ? (
            <MarkdownRenderer
              markdown={previewText}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
          ) : (
            <p className="text-sm text-gray-500">プレビューする内容がありません</p>
          )}
        </div>
      )}
    </div>
  );
}
