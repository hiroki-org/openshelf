"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const BLUR_DELAY_MS = 120;

type TagAutocompleteInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  orgSlug?: string;
  className?: string;
};

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitEditingState(value: string): {
  committed: string[];
  currentRaw: string;
  currentTrimmed: string;
} {
  const parts = value.split(",");
  if (parts.length === 0) {
    return { committed: [], currentRaw: "", currentTrimmed: "" };
  }
  const currentRaw = parts[parts.length - 1];
  const committed = parts.slice(0, -1).map((tag) => tag.trim()).filter(Boolean);
  return { committed, currentRaw, currentTrimmed: currentRaw.trim() };
}

export function TagAutocompleteInput({
  id,
  value,
  onChange,
  placeholder,
  orgSlug,
  className,
}: TagAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, string[]>());
  const blurTimeoutRef = useRef<number | null>(null);

  const { committed, currentTrimmed } = useMemo(
    () => splitEditingState(value),
    [value],
  );

  useEffect(() => {
    if (currentTrimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      setOpen(false);
      return;
    }

    const normalizedQuery = currentTrimmed.toLowerCase();
    const cacheKey = `${orgSlug ?? ""}::${normalizedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setHighlightedIndex(cached.length > 0 ? 0 : -1);
      setOpen(cached.length > 0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: currentTrimmed });
        if (orgSlug) params.set("orgSlug", orgSlug);
        const response = await apiFetch(`/api/tags/suggest?${params.toString()}`);
        if (!response.ok) {
          setSuggestions([]);
          setHighlightedIndex(-1);
          setOpen(false);
          return;
        }
        const body = (await response.json()) as { tags?: unknown };
        const nextSuggestions = Array.isArray(body.tags)
          ? body.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        cacheRef.current.set(cacheKey, nextSuggestions);
        setSuggestions(nextSuggestions);
        setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1);
        setOpen(nextSuggestions.length > 0);
      } catch {
        setSuggestions([]);
        setHighlightedIndex(-1);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [currentTrimmed, orgSlug]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const applySuggestion = (suggestion: string) => {
    const next = [...committed, suggestion].join(", ");
    onChange(`${next}, `);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const listId = `${id}-suggestions`;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          if (blurTimeoutRef.current !== null) {
            window.clearTimeout(blurTimeoutRef.current);
          }
          blurTimeoutRef.current = window.setTimeout(
            () => setOpen(false),
            BLUR_DELAY_MS,
          );
        }}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0,
            );
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1,
            );
            return;
          }
          if (
            event.key === "Enter" &&
            highlightedIndex >= 0 &&
            highlightedIndex < suggestions.length
          ) {
            const selectedSuggestion = suggestions[highlightedIndex];
            if (!selectedSuggestion) return;
            event.preventDefault();
            applySuggestion(selectedSuggestion);
          }
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        className={className}
        placeholder={placeholder}
      />

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applySuggestion(suggestion)}
              className={`cursor-pointer px-3 py-2 ${
                index === highlightedIndex
                  ? "bg-gray-100 dark:bg-gray-800"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/80"
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}

      {committed.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {parseTags(value).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {loading && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          候補を取得中...
        </p>
      )}
    </div>
  );
}
