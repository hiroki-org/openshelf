import type { Metadata } from "next";
import { Suspense } from "react";
import UserPageClient from "./user-page-client";
import { safePath } from "@/lib/sanitization";

type Params = { id: string };

type UserProfile = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

type UserResponse = {
  user: UserProfile;
};

const API_FETCH_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8787";
const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:8787";
const SITE_BASE =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

async function fetchUserMetadata(id: string): Promise<UserResponse | null> {
  try {
    const res = await fetch(`${API_FETCH_BASE}/api/users/${safePath(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { id } = await Promise.resolve(props.params);
  try {
    safePath(id);
  } catch {
    return { title: "OpenShelf" };
  }

  const data = await fetchUserMetadata(id);
  const title = data
    ? `${data.user.displayName ?? data.user.name} | OpenShelf`
    : "ユーザー詳細 | OpenShelf";

  return {
    title,
    alternates: {
      types: {
        "application/atom+xml": `${PUBLIC_API_BASE}/feed/users/${id}/atom.xml`,
      },
    },
    openGraph: {
      title,
      url: `${SITE_BASE}/users/${id}`,
    },
  };
}

export default async function UserPage(props: {
  params: Params | Promise<Params>;
}) {
  const { id } = await Promise.resolve(props.params);

  try {
    safePath(id);
  } catch {
    return <div className="text-center py-16">無効な識別子です</div>;
  }

  const data = await fetchUserMetadata(id);

  return (
    <Suspense fallback={<div className="text-center py-16">読み込み中...</div>}>
      <UserPageClient id={id} initialUser={data?.user ?? null} />
    </Suspense>
  );
}
