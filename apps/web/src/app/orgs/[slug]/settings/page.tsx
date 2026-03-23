"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Org, Member, SearchUser, OrgPaper, PaperSearchResult } from "./types";
import { GeneralTab } from "./components/general-tab";
import { MembersTab } from "./components/members-tab";
import { PapersTab } from "./components/papers-tab";

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
  const [paperSearchResults, setPaperSearchResults] = useState<PaperSearchResult[]>([]);
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

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members);
      } else {
        setError("メンバー情報の取得に失敗しました");
        return;
      }

      if (papersRes.ok) {
        const papersData = await papersRes.json();
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
            (p: PaperSearchResult) =>
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

      {tab === "general" && (
        <GeneralTab
          org={org}
          formState={{
            editName,
            editSlug,
            editDescription,
            saveMsg,
            saving,
          }}
          formActions={{
            setEditName,
            setEditSlug,
            setEditDescription,
            handleSave,
          }}
          deleteState={{
            showDelete,
            deleteConfirm,
            deleting,
          }}
          deleteActions={{
            setShowDelete,
            setDeleteConfirm,
            handleDelete,
          }}
        />
      )}

      {tab === "members" && (
        <MembersTab
          searchQuery={searchQuery}
          handleUserSearch={handleUserSearch}
          searchResults={searchResults}
          handleAddMember={handleAddMember}
          inviting={inviting}
          members={members}
          user={user}
          handleChangeRole={handleChangeRole}
          handleRemoveMember={handleRemoveMember}
        />
      )}

      {tab === "papers" && (
        <PapersTab
          paperSearch={paperSearch}
          handlePaperSearch={handlePaperSearch}
          paperSearchResults={paperSearchResults}
          handleAddPaper={handleAddPaper}
          addingPaper={addingPaper}
          orgPapers={orgPapers}
          handleRemovePaper={handleRemovePaper}
        />
      )}
    </div>
  );
}
