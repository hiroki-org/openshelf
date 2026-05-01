"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type Org = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type Member = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

type SearchUser = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type OrgPaper = {
  id: string;
  title: string;
  visibility: string;
  year: number | null;
  venue: string | null;
};

export default function OrgSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"general" | "members" | "papers">(
    (searchParams.get("tab") as "general" | "members" | "papers") || "general",
  );
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgPapers, setOrgPapers] = useState<OrgPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userSearchRef = useRef(0);
  const paperSearchRef = useRef(0);

  // General tab
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Members tab
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [inviting, setInviting] = useState(false);

  // Papers tab
  const [paperSearch, setPaperSearch] = useState("");
  const [paperSearchResults, setPaperSearchResults] = useState<
    { id: string; title: string }[]
  >([]);
  const [addingPaper, setAddingPaper] = useState(false);

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, membersRes, papersRes] = await Promise.all([
        apiFetch(`/api/orgs/${encodeURIComponent(slug)}`),
        apiFetch(`/api/orgs/${encodeURIComponent(slug)}/members`),
        apiFetch(`/api/orgs/${encodeURIComponent(slug)}/papers`),
      ]);

      if (!orgRes.ok) {
        setError("組織が見つかりません");
        return;
      }

      const orgData = await orgRes.json();
      setOrg(orgData.org);
      setEditName(orgData.org.name);
      setEditSlug(orgData.org.slug);
      setEditDescription(orgData.org.description ?? "");

      const [membersData, papersData] = await Promise.all([
        membersRes.ok ? membersRes.json() : Promise.resolve(null),
        papersRes.ok ? papersRes.json() : Promise.resolve(null),
      ]);

      if (!membersRes.ok || !membersData) {
        setError("メンバー情報の取得に失敗しました");
        return;
      }

      setMembers(membersData.members);

      if (papersRes.ok && papersData) {
        setOrgPapers(papersData.papers);
      }
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }
    fetchData();
  }, [authLoading, user, fetchData, router]);

  // Check admin status derived from members list
  const isAdmin = Boolean(
    user &&
    members.find((m) => m.userId === user.id)?.role.match(/^(admin|owner)$/),
  );

  // Redirect non-admin
  useEffect(() => {
    if (!loading && !authLoading && members.length > 0 && !isAdmin) {
      router.push(`/orgs/${slug}`);
    }
  }, [loading, authLoading, isAdmin, members, slug, router]);

  if (authLoading || loading)
    return <div className="text-center py-20">読み込み中...</div>;
  if (error)
    return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!org || !isAdmin) return null;

  // ── General handlers ──
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
    try {
      const res = await apiFetch(`/api/orgs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        alert(data.error ?? "削除に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    } finally {
      setDeleting(false);
    }
  };

  // ── Members handlers ──
  const handleUserSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const requestId = ++userSearchRef.current;
    try {
      const res = await apiFetch(
        `/api/users/search?q=${encodeURIComponent(q)}`,
      );
      if (userSearchRef.current !== requestId) return;
      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(members.map((m) => m.userId));
        setSearchResults(
          data.users.filter((u: SearchUser) => !existingIds.has(u.id)),
        );
      }
    } catch {
      if (userSearchRef.current !== requestId) return;
      setSearchResults([]);
    }
  };

  const handleAddMember = async (userId: string, role: string = "member") => {
    setInviting(true);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        },
      );
      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error ?? "追加に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error ?? "変更に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error ?? "削除に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    }
  };

  // ── Papers handlers ──
  const handlePaperSearch = async (q: string) => {
    setPaperSearch(q);
    if (q.length < 2) {
      setPaperSearchResults([]);
      return;
    }
    const requestId = ++paperSearchRef.current;
    try {
      // GET /api/papers returns all papers; filter client-side by title
      const res = await apiFetch("/api/papers");
      if (paperSearchRef.current !== requestId) return;
      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(orgPapers.map((p) => p.id));
        const lowerQ = q.toLowerCase();
        setPaperSearchResults(
          (data.papers || []).filter(
            (p: { id: string; title: string }) =>
              !existingIds.has(p.id) && p.title.toLowerCase().includes(lowerQ),
          ),
        );
      }
    } catch {
      if (paperSearchRef.current !== requestId) return;
      setPaperSearchResults([]);
    }
  };

  const handleAddPaper = async (paperId: string) => {
    setAddingPaper(true);
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/papers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId }),
        },
      );
      if (res.ok) {
        setPaperSearch("");
        setPaperSearchResults([]);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error ?? "追加に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    } finally {
      setAddingPaper(false);
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    if (!confirm("この論文の紐づけを解除しますか？")) return;
    try {
      const res = await apiFetch(
        `/api/orgs/${encodeURIComponent(slug)}/papers/${encodeURIComponent(paperId)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error ?? "削除に失敗しました");
      }
    } catch {
      alert("ネットワークエラー");
    }
  };

  const tabClass = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${
      tab === t
        ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
    }`;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/orgs/${slug}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 組織ページに戻る
        </Link>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">{org.name} — 設定</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b dark:border-gray-700 mb-6">
        <button
          type="button"
          className={tabClass("general")}
          onClick={() => setTab("general")}
        >
          一般
        </button>
        <button
          type="button"
          className={tabClass("members")}
          onClick={() => setTab("members")}
        >
          メンバー
        </button>
        <button
          type="button"
          className={tabClass("papers")}
          onClick={() => setTab("papers")}
        >
          論文
        </button>
      </div>

      {/* ── General Tab ── */}
      {tab === "general" && (
        <div className="space-y-4">
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
                    }}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Members Tab ── */}
      {tab === "members" && (
        <div>
          {/* Invite form */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">メンバーを追加</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleUserSearch(e.target.value)}
              placeholder="ユーザー名またはGitHub IDで検索..."
              aria-label="メンバー検索"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-900"
            />
            {searchResults.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md dark:border-gray-700">
                {searchResults.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      {u.avatarUrl && (
                        <Image
                          src={u.avatarUrl}
                          alt={u.name}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                      )}
                      <span>{u.displayName ?? u.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddMember(u.id)}
                      disabled={inviting}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      追加
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Member list */}
          <h3 className="text-sm font-medium mb-2">メンバー一覧</h3>
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  {m.avatarUrl && (
                    <Image
                      src={m.avatarUrl}
                      alt={m.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  )}
                  <span>{m.displayName ?? m.name}</span>
                  <span className="text-xs text-gray-400">@{m.githubId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role === "owner" ? "admin" : m.role}
                    onChange={(e) => handleChangeRole(m.userId, e.target.value)}
                    disabled={m.userId === user?.id}
                    className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                  {m.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      削除
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Papers Tab ── */}
      {tab === "papers" && (
        <div>
          {/* Add paper form */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">論文を追加</h3>
            <input
              type="text"
              value={paperSearch}
              onChange={(e) => handlePaperSearch(e.target.value)}
              placeholder="論文タイトルで検索..."
              aria-label="論文検索"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-900"
            />
            {paperSearchResults.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md dark:border-gray-700">
                {paperSearchResults.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="truncate">{p.title}</span>
                    <button
                      type="button"
                      onClick={() => handleAddPaper(p.id)}
                      disabled={addingPaper}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50 shrink-0"
                    >
                      追加
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Paper list */}
          <h3 className="text-sm font-medium mb-2">紐づけ済み論文</h3>
          {orgPapers.length === 0 ? (
            <p className="text-sm text-gray-500">まだ論文がありません</p>
          ) : (
            <ul className="space-y-2">
              {orgPapers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-sm border rounded-md p-3 dark:border-gray-700"
                >
                  <span className="truncate flex-1 min-w-0">{p.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePaper(p.id)}
                    className="text-red-500 hover:text-red-700 text-xs shrink-0 ml-2"
                  >
                    解除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
