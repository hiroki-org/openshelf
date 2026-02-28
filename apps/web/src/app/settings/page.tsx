"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) setDisplayName(user.displayName ?? "");
  }, [user]);

  if (loading || !user) return null;

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const trimmed = displayName.trim();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: trimmed.length > 0 ? trimmed : null,
      }),
    });
    if (res.ok) {
      setMessage("保存しました");
      await refresh();
    } else {
      const data = await res.json();
      setMessage(data.error ?? "エラーが発生しました");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>

      <label className="block text-sm font-medium mb-1">
        GitHub ユーザー名
      </label>
      <p className="mb-4 text-gray-500">{user.name}</p>

      <label className="block text-sm font-medium mb-1">表示名</label>
      <input
        type="text"
        maxLength={50}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        placeholder="表示名を入力（空欄でGitHub名にフォールバック）"
      />
      <p className="text-xs text-gray-400 mt-1">1〜50文字</p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {saving ? "保存中..." : "保存"}
      </button>

      {message && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          {message}
        </p>
      )}
    </div>
  );
}
