"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 40;
const SLUG_DEBOUNCE_MS = 400;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

interface NewOrgFormProps {
  onSuccess: (orgSlug: string) => void;
}

export function NewOrgForm({ onSuccess }: NewOrgFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  const slugCheckRef = useRef(0);

  // Check slug availability
  const checkSlug = useCallback(async (s: string) => {
    if (s.length < SLUG_MIN_LENGTH || s.length > SLUG_MAX_LENGTH || !SLUG_RE.test(s) || s.includes("--")) {
      setSlugStatus("invalid");
      return;
    }
    const requestId = ++slugCheckRef.current;
    setSlugStatus("checking");
    try {
      const res = await apiFetch(`/api/orgs/${encodeURIComponent(s)}`);
      // Ignore stale responses
      if (slugCheckRef.current !== requestId) return;
      if (res.status === 404) {
        setSlugStatus("available");
      } else {
        setSlugStatus("taken");
      }
    } catch {
      if (slugCheckRef.current !== requestId) return;
      setSlugStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (!slug || slug.length < SLUG_MIN_LENGTH) {
      setSlugStatus(slug.length > 0 ? "invalid" : "idle");
      return;
    }
    const timer = setTimeout(() => checkSlug(slug), SLUG_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slug, checkSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("組織名は必須です");
      return;
    }
    if (slug.length < SLUG_MIN_LENGTH) {
      setError(`スラッグは${SLUG_MIN_LENGTH}文字以上必要です`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onSuccess(data.org.slug);
        return;
      }

      const data = await res.json();
      setError(data.error ?? "作成に失敗しました");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const slugStatusText = () => {
    switch (slugStatus) {
      case "checking":
        return <span className="text-gray-400 text-xs">確認中...</span>;
      case "available":
        return <span className="text-green-600 text-xs">✓ 使用可能</span>;
      case "taken":
        return <span className="text-red-600 text-xs">✗ 使用済み</span>;
      case "invalid":
        return (
          <span className="text-red-600 text-xs">
            ※ {SLUG_MIN_LENGTH}〜{SLUG_MAX_LENGTH}文字、英小文字・数字・ハイフンのみ
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium mb-1">
          組織名 <span className="text-red-500">*</span>
        </label>
        <input
          id="org-name"
          type="text"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          required
        />
      </div>

      <div>
        <label htmlFor="org-slug" className="block text-sm font-medium mb-1">
          スラッグ <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">/orgs/</span>
          <input
            id="org-slug"
            type="text"
            maxLength={SLUG_MAX_LENGTH}
            value={slug}
            onChange={(e) => {
              setSlugManual(true);
              setSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              );
            }}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            required
          />
        </div>
        <div className="mt-1">{slugStatusText()}</div>
      </div>

      <div>
        <label
          htmlFor="org-description"
          className="block text-sm font-medium mb-1"
        >
          説明
        </label>
        <textarea
          id="org-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={
          submitting ||
          slugStatus === "checking" ||
          slugStatus === "taken" ||
          slugStatus === "invalid"
        }
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {submitting ? "作成中..." : "作成"}
      </button>
    </form>
  );
}
