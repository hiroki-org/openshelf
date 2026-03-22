"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import Link from "next/link";
import { NewOrgForm } from "@/components/orgs/new-org-form";

export default function NewOrgPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  if (loading || !user) return null;

  const handleCreateSuccess = useCallback(
    (slug: string) => {
      router.push(`/orgs/${slug}`);
    },
    [router],
  );

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">組織を作成</h1>

      <NewOrgForm onSuccess={handleCreateSuccess} />
    </div>
  );
}
