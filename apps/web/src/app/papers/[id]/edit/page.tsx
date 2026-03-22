"use client";

import { useAuth } from "@/components/auth-provider";
import {
  PaperEditData,
  PaperEditForm,
  UserOrganization,
} from "@/components/papers/edit-form";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PaperEditResponse = {
  paper: PaperEditData;
  authors: Array<{ userId: string }>;
  organizations: Array<{ id: string; name: string; slug: string }>;
};

function mergeOrganizations(
  memberOrganizations: UserOrganization[],
  selectedOrganizations: PaperEditResponse["organizations"],
): UserOrganization[] {
  const merged = new Map<string, UserOrganization>();

  for (const org of selectedOrganizations) {
    merged.set(org.id, {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: null,
      isExistingTarget: true,
    });
  }

  for (const org of memberOrganizations) {
    const existing = merged.get(org.id);
    merged.set(org.id, {
      ...existing,
      ...org,
      isExistingTarget: existing?.isExistingTarget ?? false,
    });
  }

  return [...merged.values()];
}

export default function PaperEditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const paperId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paperData, setPaperData] = useState<PaperEditData | null>(null);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [initialSelectedOrgIds, setInitialSelectedOrgIds] = useState<string[]>([]);
  const [orgsWarning, setOrgsWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPaper = async () => {
      try {
        const paperPromise = apiFetch(`/api/papers/${encodeURIComponent(paperId)}`);
        const orgsPromise = apiFetch("/api/users/me/orgs");

        const [paperSettled, orgsSettled] = await Promise.allSettled([paperPromise, orgsPromise]);

        if (paperSettled.status === "rejected") {
          throw new Error("論文の取得に失敗しました");
        }
        const paperRes = paperSettled.value;

        let orgsRes: Response | null = null;
        if (orgsSettled.status === "fulfilled") {
          orgsRes = orgsSettled.value;
        }

        if (!paperRes.ok) {
          if (paperRes.status === 401 || paperRes.status === 403) {
            router.replace("/");
            return;
          }
          throw new Error("論文の取得に失敗しました");
        }

        const data = (await paperRes.json()) as PaperEditResponse;
        const isAuthor = data.authors.some((author) => author.userId === user.id);
        if (!isAuthor) {
          router.replace(`/papers/${paperId}`);
          return;
        }

        let memberOrganizations: UserOrganization[] = [];
        if (orgsRes?.ok) {
          const orgsData = (await orgsRes.json()) as {
            organizations: UserOrganization[];
          };
          memberOrganizations = orgsData.organizations ?? [];
          setOrgsWarning(null);
        } else {
          setOrgsWarning(
            orgsRes
              ? `組織情報の取得に失敗しました（status: ${orgsRes.status}）。現在は組織公開を変更できません。`
              : "組織情報の取得に失敗しました。現在は組織公開を変更できません。",
          );
        }

        const selectedOrganizations = data.organizations ?? [];
        setPaperData(data.paper);
        setOrganizations(mergeOrganizations(memberOrganizations, selectedOrganizations));
        setInitialSelectedOrgIds(selectedOrganizations.map((org) => org.id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "予期せぬエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [paperId, user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!paperData) {
    return null;
  }

  return (
    <PaperEditForm
      paperId={paperId}
      initialData={paperData}
      organizations={organizations}
      initialSelectedOrgIds={initialSelectedOrgIds}
      orgsWarning={orgsWarning}
    />
  );
}
