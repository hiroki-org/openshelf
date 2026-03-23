"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Org, Member, OrgPaper } from "./components/types";
import { GeneralTab } from "./components/general-tab";
import { MembersTab } from "./components/members-tab";
import { PapersTab } from "./components/papers-tab";

const TAB_BASE_CLASS = "px-4 py-2 text-sm font-medium border-b-2";
const TAB_ACTIVE_CLASS =
  "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400";
const TAB_INACTIVE_CLASS =
  "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300";

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{org.name} — 設定</h1>
        <Link
          href={`/orgs/${slug}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          組織ページへ戻る
        </Link>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8">
        <button
          type="button"
          onClick={() => {
            setTab("general");
            router.replace(`?tab=general`, { scroll: false });
          }}
          className={`${TAB_BASE_CLASS} ${
            tab === "general" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
          }`}
        >
          基本設定
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("members");
            router.replace(`?tab=members`, { scroll: false });
          }}
          className={`${TAB_BASE_CLASS} ${
            tab === "members" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
          }`}
        >
          メンバー
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("papers");
            router.replace(`?tab=papers`, { scroll: false });
          }}
          className={`${TAB_BASE_CLASS} ${
            tab === "papers" ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS
          }`}
        >
          論文
        </button>
      </div>

      {tab === "general" && (
        <GeneralTab org={org} slug={slug} setOrg={setOrg} />
      )}

      {tab === "members" && (
        <MembersTab members={members} slug={slug} fetchData={fetchData} user={user} />
      )}

      {tab === "papers" && (
        <PapersTab orgPapers={orgPapers} slug={slug} fetchData={fetchData} />
      )}
    </div>
  );
}
