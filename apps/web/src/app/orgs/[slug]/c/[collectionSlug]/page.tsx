import type { Metadata } from "next";
import OrgCollectionPageClient from "./org-collection-page-client";

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function fetchCollectionMetadata(slug: string, collectionSlug: string) {
  try {
    const [orgRes, collectionsRes] = await Promise.all([
      fetch(`${API_BASE}/api/orgs/${slug}`, { cache: "no-store" }),
      fetch(`${API_BASE}/api/orgs/${slug}/collections`, { cache: "no-store" }),
    ]);

    if (!orgRes.ok || !collectionsRes.ok) return null;

    const orgData = (await orgRes.json()) as OrgResponse;
    const collectionsData =
      (await collectionsRes.json()) as CollectionsResponse;
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
  params: Params;
}): Promise<Metadata> {
  const { slug, collectionSlug } = props.params;
  const data = await fetchCollectionMetadata(slug, collectionSlug);

  if (!data) {
    const title = "コレクション詳細 | OpenShelf";
    const ogImage = buildOgImageUrl(title);
    return {
      title,
      openGraph: {
        title,
        url: `${SITE_BASE}/orgs/${slug}/c/${collectionSlug}`,
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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_BASE}/orgs/${slug}/c/${collectionSlug}`,
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
  params: Params;
}) {
  const { slug, collectionSlug } = props.params;
  return (
    <OrgCollectionPageClient slug={slug} collectionSlug={collectionSlug} />
  );
}
