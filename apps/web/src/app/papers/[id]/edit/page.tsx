"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaperEditForm, PaperEditData } from "@/components/papers/edit-form";

type PaperEditResponse = {
  paper: PaperEditData;
  authors: Array<{ userId: string }>;
};

export default function PaperEditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const paperId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paperData, setPaperData] = useState<PaperEditData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchPaper = async () => {
      try {
        const res = await apiFetch(`/api/papers/${encodeURIComponent(paperId)}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.replace("/");
            return;
          }
          throw new Error("論文の取得に失敗しました");
        }

        const data = (await res.json()) as PaperEditResponse;
        const paper = data.paper;

        // Ensure user is an author
        const isAuthor = data.authors.some((author) => author.userId === user.id);
        if (!isAuthor) {
          router.replace(`/papers/${paperId}`);
          return;
        }

        setPaperData(paper);
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

  return <PaperEditForm paperId={paperId} initialData={paperData} />;
}
