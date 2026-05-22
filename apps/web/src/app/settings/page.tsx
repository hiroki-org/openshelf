"use client";

import { useAuth } from "@/components/auth-provider";
import { Spinner } from "@/components/spinner";
import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null,
  );

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setDisplayName(user.displayName ?? "");
  }, [user]);

  const trimmedDisplayName = useMemo(() => displayName.trim(), [displayName]);

  if (loading || !user) return null;

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setMessageType(null);
    try {
      const res = await apiFetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName:
            trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
        }),
      });

      if (res.ok) {
        setMessage("保存しました");
        setMessageType("success");
        await refresh();
        return;
      }

      let errorMessage = "エラーが発生しました";
      try {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (data?.error && typeof data.error === "string") {
            errorMessage = data.error;
          }
        } else {
          const text = await res.text();
          if (text) errorMessage = text;
        }
      } catch {
        // Keep default fallback message.
      }

      setMessage(errorMessage);
      setMessageType("error");
    } catch {
      setMessage("ネットワークエラーが発生しました");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <div className="mb-8 rounded-3xl border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:px-8 sm:py-8">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Profile settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
          プロフィール設定
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
          表示名を調整して、OpenShelf 上での見え方を整えます。GitHub
          のユーザー名はそのまま保持され、表示名を空欄にすると自動的にフォールバックされます。
        </p>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-7">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-50">
            公開プロフィール
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            他のユーザーに見える基本情報です。
          </p>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              GitHub ユーザー名
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              @{user.name}
            </p>
          </div>

          <div>
            <label
              htmlFor="display-name"
              className="mb-1 block text-sm font-medium"
            >
              表示名
            </label>
            <input
              id="display-name"
              type="text"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-describedby="display-name-counter"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="表示名を入力（空欄でGitHub名にフォールバック）"
            />
            <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <span>1〜50文字</span>
              <span id="display-name-counter">{displayName.length}/50</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              プレビュー
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {trimmedDisplayName || user.name}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              表示名が未設定の場合は GitHub ユーザー名が使われます
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? "保存中..." : "保存"}
          </button>

          {message && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                messageType === "error"
                  ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  : "border border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
