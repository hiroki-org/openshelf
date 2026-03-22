"use client";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { safePath } from "@/lib/sanitization";

import { Org, OrgPaper, Member, Collection } from "./types";
import { OrgHeader } from "./components/org-header";
import { CollectionList } from "./components/collection-list";
import { MemberList } from "./components/member-list";
import { PaperList } from "./components/paper-list";

type OrgPageClientProps = {
  slug: string;
};

export default function OrgPageClient({ slug }: OrgPageClientProps) {
  const { user } = useAuth();

  const [org, setOrg] = useState<Org | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [orgPapers, setOrgPapers] = useState<OrgPaper[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = members.some(
    (m) => m.userId === user?.id && (m.role === "admin" || m.role === "owner"),
  );

  const fetchOrg = useCallback(async () => {
    try {
      const [orgRes, papersRes, membersRes, collectionsRes] = await Promise.all([
        apiFetch(`/api/orgs/${safePath(slug)}`),
        apiFetch(`/api/orgs/${safePath(slug)}/papers`),
        apiFetch(`/api/orgs/${safePath(slug)}/members`),
        apiFetch(`/api/orgs/${safePath(slug)}/collections`),
      ]);

      if (!orgRes.ok) {
        setError(
          orgRes.status === 404 ? "組織が見つかりません" : "取得に失敗しました",
        );
        return;
      }

      const orgData = await orgRes.json();
      setOrg(orgData.org);
      setMemberCount(orgData.memberCount);

      if (papersRes.ok) {
        const papersData = await papersRes.json();
        setOrgPapers(papersData.papers);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members);
      }

      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json();
        setCollections(collectionsData.collections ?? []);
      }
    } catch {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  if (loading) return <div className="text-center py-20">読み込み中...</div>;
  if (error)
    return <div className="text-center py-20 text-red-600">{error}</div>;
  if (!org) return null;

  return (
    <div className="max-w-4xl">
      <OrgHeader
        org={org}
        memberCount={memberCount}
        paperCount={orgPapers.length}
        collectionCount={collections.length}
        isAdmin={isAdmin}
      />

      <CollectionList
        collections={collections}
        slug={slug}
        isAdmin={isAdmin}
      />

      <MemberList members={members} />

      <PaperList
        papers={orgPapers}
        slug={slug}
        isAdmin={isAdmin}
      />
    </div>
  );
}
