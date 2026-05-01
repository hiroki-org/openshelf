import type { Metadata } from "next";
import { safePath } from "@/lib/sanitization";
import UserCollectionPageClient from "./user-collection-page-client";

type Params = { id: string; collectionSlug: string };

type UserResponse = {
  user: {
    id: string;
    name: string;
    displayName: string | null;
  };
};

type Collection = {
  slug: string;
  name: string;
  description: string | null;
};

type CollectionsResponse = {
  collections: Collection[];
};

const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8787";
const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const SITE_BASE =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

async function fetchCollectionMetadata(id: string, collectionSlug: string) {
  try {
    const [userRes, collectionsRes] = await Promise.all([
      fetch(`${API_BASE}/api/users/${safePath(id)}`, { cache: "no-store" }),
      fetch(`${API_BASE}/api/users/${safePath(id)}/collections`, {
        cache: "no-store",
      }),
    ]);
    if (!userRes.ok || !collectionsRes.ok) return null;

    const [userData, collectionsData] = await Promise.all([
      userRes.json() as Promise<UserResponse>,
      collectionsRes.json() as Promise<CollectionsResponse>,
    ]);
    const collection = collectionsData.collections.find(
      (item) => item.slug === collectionSlug,
    );
    if (!collection) return null;

    return {
      userName: userData.user.displayName ?? userData.user.name,
      collection,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { id, collectionSlug } = await Promise.resolve(props.params);
  let safeId: string;
  let safeCollectionSlug: string;
  try {
    safeId = safePath(id);
    safeCollectionSlug = safePath(collectionSlug);
  } catch {
    return { title: "OpenShelf" };
  }

  const data = await fetchCollectionMetadata(id, collectionSlug);
  if (!data) {
    return { title: "コレクション詳細 | OpenShelf" };
  }

  const title = `${data.collection.name} | ${data.userName} | OpenShelf`;
  const description =
    data.collection.description ?? `${data.userName} のコレクション`;
  const feedUrl = `${PUBLIC_API_BASE}/feed/users/${safeId}/collections/${safeCollectionSlug}/atom.xml`;

  return {
    title,
    description,
    alternates: {
      types: {
        "application/atom+xml": feedUrl,
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_BASE}/users/${safeId}/c/${safeCollectionSlug}`,
    },
  };
}

export default async function UserCollectionPage(props: {
  params: Params | Promise<Params>;
}) {
  const { id, collectionSlug } = await Promise.resolve(props.params);
  try {
    safePath(id);
    safePath(collectionSlug);
  } catch {
    return <div className="text-center py-16">無効な識別子です</div>;
  }

  return <UserCollectionPageClient id={id} collectionSlug={collectionSlug} />;
}
