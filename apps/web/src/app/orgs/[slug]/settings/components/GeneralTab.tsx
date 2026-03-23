import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Org } from "./types";

export function GeneralTab({
  org,
  slug,
  setOrg,
}: {
  org: Org;
  slug: string;
  setOrg: (org: Org) => void;
}) {
  const router = useRouter();

  // General tab
  const [editName, setEditName] = useState(org.name);
  const [editSlug, setEditSlug] = useState(org.slug);
  const [editDescription, setEditDescription] = useState(org.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await apiFetch(`/api/orgs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          slug: editSlug.trim().toLowerCase(),
          description: editDescription.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrg(data.org);
        setEditName(data.org.name);
        setEditSlug(data.org.slug);
        setEditDescription(data.org.description ?? "");
        setSaveMsg("保存しました");
        if (data.org.slug !== slug) {
          router.replace(`/orgs/${data.org.slug}/settings`);
        }
      } else {
        const data = await res.json();
        setSaveMsg(data.error ?? "保存に失敗しました");
      }
    } catch {
      setSaveMsg("ネットワークエラー");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/orgs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        setDeleteError(data.error ?? "削除に失敗しました");
      }
    } catch {
      setDeleteError("ネットワークエラー");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label
          htmlFor="org-edit-name"
          className="block text-sm font-medium mb-1"
        >
          組織名
        </label>
        <input
          id="org-edit-name"
          type="text"
          maxLength={100}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <div>
        <label
          htmlFor="org-edit-slug"
          className="block text-sm font-medium mb-1"
        >
          スラッグ
        </label>
        <input
          id="org-edit-slug"
          type="text"
          maxLength={40}
          value={editSlug}
          onChange={(e) =>
            setEditSlug(
              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            )
          }
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <div>
        <label
          htmlFor="org-edit-description"
          className="block text-sm font-medium mb-1"
        >
          説明
        </label>
        <textarea
          id="org-edit-description"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {saveMsg && <p className="text-sm text-gray-600">{saveMsg}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {saving ? "保存中..." : "保存"}
      </button>

      {/* Danger zone */}
      <div className="mt-10 rounded-md border border-red-300 p-4 dark:border-red-700">
        <h3 className="text-sm font-medium text-red-600 mb-2">
          Danger Zone
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          組織を削除すると、メンバー情報と論文の紐づけが全て削除されます。
        </p>
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            組織を削除
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-600">
              確認のため「<strong>{org.slug}</strong>」を入力してください。
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              aria-label="削除確認のためスラッグを入力"
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm dark:border-red-700 dark:bg-gray-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== org.slug}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "削除中..." : "完全に削除する"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirm("");
                  setDeleteError("");
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                キャンセル
              </button>
            </div>
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
