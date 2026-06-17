"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const COLLECTION_NAME_MAX_LENGTH = 100;
const COLLECTION_DESCRIPTION_MAX_LENGTH = 500;
const COUNTER_WARNING_RATIO = 0.9;

function counterClassName(length: number, maxLength: number): string {
  return length >= Math.ceil(maxLength * COUNTER_WARNING_RATIO)
    ? "text-red-500 dark:text-red-400"
    : "text-gray-500 dark:text-gray-400";
}

export default function NewCollectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [ownerType, setOwnerType] = useState<"user" | "org">("user");
  const [orgSlug, setOrgSlug] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "org_only" | "private"
  >("private");

  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slugCheckRef = useRef(0);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  const ownerHint = useMemo(() => {
    if (ownerType === "user")
      return "あなたの個人コレクションとして作成されます";
    if (!orgSlug) return "組織スラッグを入力してください";
    return `組織 @${orgSlug} のコレクションとして作成されます`;
  }, [ownerType, orgSlug]);

  useEffect(() => {
    slugCheckRef.current += 1;
    setSlugStatus("idle");
  }, [ownerType]);

  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (
      slug.length < 3 ||
      slug.length > 40 ||
      !SLUG_RE.test(slug) ||
      slug.includes("--")
    ) {
      setSlugStatus("invalid");
      return;
    }

    const requestId = ++slugCheckRef.current;
    const t = setTimeout(async () => {
      setSlugStatus("checking");

      try {
        if (ownerType === "org" && !orgSlug.trim()) {
          setSlugStatus("idle");
          return;
        }

        const url =
          ownerType === "user"
            ? user?.id
              ? `/api/users/${user.id}/collections`
              : null
            : `/api/orgs/${encodeURIComponent(orgSlug)}/collections`;
        if (!url) {
          setSlugStatus("idle");
          return;
        }

        const res = await apiFetch(url);
        if (slugCheckRef.current !== requestId) return;

        if (!res.ok) {
          setSlugStatus("idle");
          return;
        }

        const data = await res.json();
        const exists = (data.collections ?? []).some(
          (c: { slug: string }) => c.slug === slug,
        );
        setSlugStatus(exists ? "taken" : "available");
      } catch {
        if (slugCheckRef.current !== requestId) return;
        setSlugStatus("idle");
      }
    }, 400);

    return () => clearTimeout(t);
  }, [slug, user, ownerType, orgSlug]);

  if (loading || !user) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">コレクションを作成</h1>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");

          if (!name.trim()) {
            setError("name is required");
            return;
          }

          if (slug.length < 3) {
            setError("slug は3文字以上必要です");
            return;
          }

          if (slugStatus === "checking" || slugStatus === "idle") {
            setError("slug の確認完了を待ってください");
            return;
          }

          if (slugStatus === "invalid" || slugStatus === "taken") {
            setError("slug を修正してください");
            return;
          }

          if (ownerType === "org" && !orgSlug.trim()) {
            setError("org slug is required");
            return;
          }

          setSubmitting(true);
          try {
            const res = await apiFetch("/api/collections", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                owner_type: ownerType,
                org_slug:
                  ownerType === "org"
                    ? orgSlug.trim().toLowerCase()
                    : undefined,
                name: name.trim(),
                slug: slug.trim().toLowerCase(),
                description: description.trim() || null,
                visibility,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              setError(data.error ?? "作成に失敗しました");
              return;
            }

            if (ownerType === "org") {
              router.push(`/orgs/${orgSlug}/c/${data.collection.slug}`);
            } else {
              router.push(`/users/${user.id}/c/${data.collection.slug}`);
            }
          } catch {
            setError("ネットワークエラー");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div>
          <fieldset>
            <legend className="block text-sm font-medium mb-1">
              owner_type
            </legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ownerType"
                  checked={ownerType === "user"}
                  onChange={() => setOwnerType("user")}
                />
                user
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ownerType"
                  checked={ownerType === "org"}
                  onChange={() => setOwnerType("org")}
                />
                org
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">{ownerHint}</p>
          </fieldset>
        </div>

        {ownerType === "org" && (
          <div>
            <label htmlFor="orgSlug" className="block text-sm font-medium mb-1">
              org slug
            </label>
            <input
              id="orgSlug"
              value={orgSlug}
              onChange={(e) =>
                setOrgSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="example-org"
            />
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={COLLECTION_NAME_MAX_LENGTH}
            aria-describedby="name-counter"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="flex justify-end mt-1">
            <span
              id="name-counter"
              className={`text-xs ${counterClassName(name.length, COLLECTION_NAME_MAX_LENGTH)}`}
            >
              {name.length}/{COLLECTION_NAME_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-1">
            slug
          </label>
          <input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlugManual(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            maxLength={40}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <p className="text-xs mt-1 text-gray-500">
            {slugStatus === "checking" && "確認中..."}
            {slugStatus === "available" && "✓ 使用可能"}
            {slugStatus === "taken" && "✗ 使用済み"}
            {slugStatus === "invalid" && "※ 3-40文字, 英小文字/数字/ハイフン"}
          </p>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-1"
          >
            description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
            aria-describedby="description-counter"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="flex justify-end mt-1">
            <span
              id="description-counter"
              aria-live="polite"
              aria-atomic="true"
              className={`text-xs ${counterClassName(description.length, COLLECTION_DESCRIPTION_MAX_LENGTH)}`}
            >
              {description.length}/{COLLECTION_DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="visibility"
            className="block text-sm font-medium mb-1"
          >
            visibility
          </label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as "public" | "org_only" | "private")
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="public">public</option>
            <option value="org_only">org_only</option>
            <option value="private">private</option>
          </select>
        </div>

        <p role="alert" className={error ? "text-sm text-red-600" : ""}>
          {error ?? ""}
        </p>

        <button
          type="submit"
          disabled={
            submitting ||
            slug.length < 3 ||
            slugStatus === "idle" ||
            slugStatus === "checking" ||
            slugStatus === "taken" ||
            slugStatus === "invalid"
          }
          className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {submitting && (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          {submitting ? "作成中..." : "作成"}
        </button>
      </form>
    </div>
  );
}
