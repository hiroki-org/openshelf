import type { Metadata } from "next";
import OrgCollectionPageClient from "./org-collection-page-client";
import { safePath } from "@/lib/sanitization";

type Params = { slug: string; collectionSlug: string };

type OrgResponse = {
  org: {
    slug: string;
    name: string;
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

async function fetchCollectionMetadata(slug: string, collectionSlug: string) {
  try {
    const [orgRes, collectionsRes] = await Promise.all([
      fetch(`${API_BASE}/api/orgs/${safePath(slug)}`, {
        cache: "no-store",
      }),
      fetch(`${API_BASE}/api/orgs/${safePath(slug)}/collections`, {
        cache: "no-store",
      }),
    ]);

    if (!orgRes.ok || !collectionsRes.ok) return null;

    const [orgData, collectionsData] = await Promise.all([
      orgRes.json() as Promise<OrgResponse>,
      collectionsRes.json() as Promise<CollectionsResponse>,
    ]);
    const collection = collectionsData.collections.find(
      (item) => item.slug === collectionSlug,
    );
    if (!collection) return null;

    return {
      orgName: orgData.org.name,
      collection,
    };
  } catch {
    return null;
  }
}

function buildOgImageUrl(title: string, subtitle?: string): string {
  const url = new URL(`${SITE_BASE}/api/og`);
  url.searchParams.set("type", "collection");
  url.searchParams.set("title", title);
  if (subtitle) {
    url.searchParams.set("subtitle", subtitle);
  }
  return url.toString();
}

export async function generateMetadata(props: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { slug, collectionSlug } = await Promise.resolve(props.params);
  let safeSlug: string;
  let safeCollectionSlug: string;
  try {
    safeSlug = safePath(slug);
    safeCollectionSlug = safePath(collectionSlug);
  } catch {
    return { title: "コレクション詳細 | OpenShelf" };
  }

  const data = await fetchCollectionMetadata(slug, collectionSlug);

  if (!data) {
    const title = "コレクション詳細 | OpenShelf";
    const ogImage = buildOgImageUrl(title);
    return {
      title,
      openGraph: {
        title,
        url: `${SITE_BASE}/orgs/${safeSlug}/c/${safeCollectionSlug}`,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        images: [ogImage],
      },
    };
  }

  const title = `${data.collection.name} | ${data.orgName} | OpenShelf`;
  const description =
    data.collection.description ?? `${data.orgName} のコレクション`;
  const ogImage = buildOgImageUrl(data.collection.name, data.orgName);
  const feedUrl = `${PUBLIC_API_BASE}/feed/orgs/${safeSlug}/collections/${safeCollectionSlug}/atom.xml`;

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
      type: "website",
      url: `${SITE_BASE}/orgs/${safeSlug}/c/${safeCollectionSlug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function OrgCollectionPage(props: {
  params: Params | Promise<Params>;
}) {
  const { slug, collectionSlug } = await Promise.resolve(props.params);
  try {
    safePath(slug);
    safePath(collectionSlug);
  } catch {
    return <div className="text-center py-20">無効な識別子です</div>;
  }
  return (
    <OrgCollectionPageClient slug={slug} collectionSlug={collectionSlug} />
  );
}
