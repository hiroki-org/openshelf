"use client";

import { TAG_DELIMITER_PATTERN, splitTagInput } from "@/lib/tags";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTagSuggestions } from "./tag-autocomplete-input/use-tag-suggestions";
import { TagChips } from "./tag-autocomplete-input/tag-chips";
import { AutocompleteDropdown } from "./tag-autocomplete-input/autocomplete-dropdown";

const BLUR_DELAY_MS = 120;

type TagAutocompleteInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  orgSlug?: string;
  className?: string;
};

function splitEditingState(value: string): {
  committed: string[];
  currentRaw: string;
  currentTrimmed: string;
} {
  const parts = value.split(TAG_DELIMITER_PATTERN);
  if (parts.length === 0) {
    return { committed: [], currentRaw: "", currentTrimmed: "" };
  }
  const currentRaw = parts[parts.length - 1];
  const committed = parts
    .slice(0, -1)
    .map((tag) => tag.trim())
    .filter(Boolean);
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);

  const { committed, currentTrimmed } = useMemo(
    () => splitEditingState(value),
    [value],
  );

  const displayChips = useMemo(() => splitTagInput(value), [value]);

  const { suggestions, loading } = useTagSuggestions(currentTrimmed, orgSlug);

  useEffect(() => {
    setHighlightedIndex(suggestions.length > 0 ? 0 : -1);
    setOpen(suggestions.length > 0);
  }, [suggestions]);

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
  const activeDescendantId =
    open && highlightedIndex >= 0 && highlightedIndex < suggestions.length
      ? `${listId}-option-${highlightedIndex}`
      : undefined;

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
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setHighlightedIndex(-1);
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
        aria-activedescendant={activeDescendantId}
        className={className}
        placeholder={placeholder}
      />

      {open && (
        <AutocompleteDropdown
          listId={listId}
          suggestions={suggestions}
          highlightedIndex={highlightedIndex}
          onSelect={applySuggestion}
        />
      )}

      <TagChips tags={displayChips} />

      {loading && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          候補を取得中...
        </p>
      )}
    </div>
  );
}
