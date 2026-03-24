"use client";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { CollectionForm } from "./components/collection-form";

export default function NewCollectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">コレクションを作成</h1>

      <CollectionForm user={user} />
    </div>
  );
}
