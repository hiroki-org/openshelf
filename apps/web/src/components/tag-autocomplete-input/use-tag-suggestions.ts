import { apiFetch } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useTagSuggestions(currentTrimmed: string, orgSlug?: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, string[]>());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (currentTrimmed.length < MIN_QUERY_LENGTH) {
      setLoading(false);
      setSuggestions([]);
      return;
    }

    const normalizedQuery = currentTrimmed.toLowerCase();
    const cacheKey = `${orgSlug ?? ""}::${normalizedQuery}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setLoading(false);
      setSuggestions(cached);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: currentTrimmed });
        if (orgSlug) params.set("orgSlug", orgSlug);
        const response = await apiFetch(
          `/api/tags/suggest?${params.toString()}`,
        );
        if (requestIdRef.current !== requestId) return;
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const body = (await response.json()) as { tags?: unknown };
        const nextSuggestions = Array.isArray(body.tags)
          ? body.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        if (requestIdRef.current !== requestId) return;
        cacheRef.current.set(cacheKey, nextSuggestions);
        setSuggestions(nextSuggestions);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [currentTrimmed, orgSlug]);

  return { suggestions, loading };
}
