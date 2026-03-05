"use client";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type UserProfile = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
};

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState("");

  const isSelf = useMemo(() => user?.id === id, [user, id]);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, collectionsRes] = await Promise.all([
          apiFetch(`/api/users/${encodeURIComponent(id)}`),
          apiFetch(`/api/users/${encodeURIComponent(id)}/collections`),
        ]);

        if (!profileRes.ok) {
          setError("ユーザーが見つかりません");
          return;
        }

        const profileData = await profileRes.json();
        setProfile(profileData.user);

        if (collectionsRes.ok) {
          const collectionsData = await collectionsRes.json();
          setCollections(collectionsData.collections ?? []);
        }
      } catch {
        setError("取得に失敗しました");
      }
    })();
  }, [id]);

  if (error)
    return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!profile) return <div className="text-center py-16">読み込み中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {profile.displayName ?? profile.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">@{profile.githubId}</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">コレクション</h2>
        {isSelf && (
          <Link
            href="/collections/new"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + 新規作成
          </Link>
        )}
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-gray-500">コレクションがありません</p>
      ) : (
        <ul className="space-y-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/users/${id}/c/${c.slug}`}
                className="block rounded-md border p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-sm">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{c.visibility}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
