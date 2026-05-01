"use client";

import { FeedButton } from "@/components/feed-button";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
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

type UserPageClientProps = {
  id: string;
  initialUser?: UserProfile | null;
};

export default function UserPageClient({ id, initialUser = null }: UserPageClientProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(initialUser);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState("");

  const isSelf = useMemo(() => user?.id === id, [user, id]);
  const feedUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/feed/users/${id}/atom.xml`;

  useEffect(() => {
    let cancelled = false;
    setError("");
    setProfile(initialUser);
    setCollections([]);

    (async () => {
      try {
        const profileResPromise = initialUser
          ? Promise.resolve(null)
          : apiFetch(`/api/users/${encodeURIComponent(id)}`);
        const [profileRes, collectionsRes] = await Promise.all([
          profileResPromise,
          apiFetch(`/api/users/${encodeURIComponent(id)}/collections`),
        ]);
        if (cancelled) return;

        if (!initialUser && (!profileRes || !profileRes.ok)) {
          setError(
            profileRes?.status === 404
              ? "ユーザーが見つかりません"
              : "ユーザー情報の取得に失敗しました",
          );
          return;
        }

        const [profileData, collectionsData] = await Promise.all([
          !initialUser && profileRes?.ok ? profileRes.json() : Promise.resolve(null),
          collectionsRes.ok ? collectionsRes.json() : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (!initialUser && profileData) {
          setProfile(profileData.user);
        }

        if (collectionsRes.ok && collectionsData) {
          setCollections(collectionsData.collections ?? []);
        }
      } catch {
        if (cancelled) return;
        setError("取得に失敗しました");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialUser]);

  if (error)
    return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!profile) return <div className="text-center py-16">読み込み中...</div>;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {profile.displayName ?? profile.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">@{profile.githubId}</p>
          </div>
          <FeedButton url={feedUrl} />
        </div>
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
