import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PdfDocumentProxy } from "./types";

const SEARCH_DEBOUNCE_MS = 350;
const TEXT_HIGHLIGHT_CLASS = "highlight";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

type UsePdfSearchProps = {
  pdfDocumentRef: React.RefObject<PdfDocumentProxy | null>;
  numPages: number;
  goToPage: (page: number) => void;
};

export function usePdfSearch({
  pdfDocumentRef,
  numPages,
  goToPage,
}: UsePdfSearchProps) {
  const searchTextCacheRef = useRef<Map<number, string>>(new Map());
  const goToPageRef = useRef(goToPage);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

  useEffect(() => {
    goToPageRef.current = goToPage;
  }, [goToPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const query = debouncedSearchQuery.toLowerCase();
    const doc = pdfDocumentRef.current;
    if (!doc || !query) {
      setSearchMatches([]);
      setActiveMatchIndex(-1);
      return;
    }

    let cancelled = false;

    void (async () => {
      const matches: number[] = [];
      for (let page = 1; page <= doc.numPages; page += 1) {
        try {
          let pageText = searchTextCacheRef.current.get(page);
          if (pageText === undefined) {
            const pdfPage = await doc.getPage(page);
            const textContent = await pdfPage.getTextContent();
            pageText = textContent.items
              .map((item) => {
                if (
                  item &&
                  typeof item === "object" &&
                  "str" in item &&
                  typeof (item as { str?: unknown }).str === "string"
                ) {
                  return (item as { str: string }).str.toLowerCase();
                }
                return "";
              })
              .join(" ");
            searchTextCacheRef.current.set(page, pageText);
          }
          if (pageText.includes(query)) {
            matches.push(page);
          }
        } catch (error) {
          const message =
            error instanceof Error ? String(error) : String(error);
          console.warn(`Failed to extract text for page ${page}:`, message);
        }
      }
      if (cancelled) return;
      setSearchMatches(matches);
      if (matches.length === 0) {
        setActiveMatchIndex(-1);
        return;
      }
      setActiveMatchIndex(0);
      goToPageRef.current(matches[0]);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, numPages, pdfDocumentRef]);

  const activeMatchPage =
    activeMatchIndex >= 0 ? searchMatches[activeMatchIndex] : undefined;

  const moveMatchCursor = useCallback(
    (direction: -1 | 1) => {
      if (searchMatches.length === 0) return;
      const current = activeMatchIndex >= 0 ? activeMatchIndex : 0;
      const next =
        (current + direction + searchMatches.length) % searchMatches.length;
      setActiveMatchIndex(next);
      goToPage(searchMatches[next]);
    },
    [activeMatchIndex, goToPage, searchMatches],
  );

  const searchRegex = useMemo(() => {
    if (!debouncedSearchQuery) return null;
    const escapedQuery = debouncedSearchQuery.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    return new RegExp("(" + escapedQuery + ")", "gi");
  }, [debouncedSearchQuery]);

  const textRenderer = useCallback(
    (textItem: { str: string }) => {
      if (!searchRegex) return escapeHtml(textItem.str);

      const parts = textItem.str.split(searchRegex);
      if (parts.length <= 1) return escapeHtml(textItem.str);

      return parts
        .map((part, i) =>
          i % 2 === 1
            ? `<mark class="${TEXT_HIGHLIGHT_CLASS}">${escapeHtml(part)}</mark>`
            : escapeHtml(part),
        )
        .join("");
    },
    [searchRegex],
  );

  const clearSearchCache = useCallback(() => {
    searchTextCacheRef.current.clear();
  }, []);

  const resetSearchState = useCallback(() => {
    setSearchMatches([]);
    setActiveMatchIndex(-1);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchMatches,
    activeMatchIndex,
    activeMatchPage,
    moveMatchCursor,
    textRenderer,
    clearSearchCache,
    resetSearchState,
  };
}
