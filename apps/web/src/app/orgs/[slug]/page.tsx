import type { Metadata } from "next";
import OrgPageClient from "./org-page-client";

type Params = { slug: string };

type OrgResponse = {
  org: {
    slug: string;
    name: string;
    description: string | null;
  };
};

const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8787";
const SITE_BASE =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

async function fetchOrgMetadata(slug: string): Promise<OrgResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/orgs/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as OrgResponse;
  } catch {
    return null;
  }
}

function buildOgImageUrl(title: string, subtitle?: string): string {
  const url = new URL(`${SITE_BASE}/api/og`);
  url.searchParams.set("type", "org");
  url.searchParams.set("title", title);
  if (subtitle) {
    url.searchParams.set("subtitle", subtitle);
  }
  return url.toString();
}

export async function generateMetadata(props: {
  params: Params | Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(props.params);
  const data = await fetchOrgMetadata(slug);

  if (!data) {
    const title = "組織詳細 | OpenShelf";
    const ogImage = buildOgImageUrl(title);
    return {
      title,
      openGraph: {
        title,
        url: `${SITE_BASE}/orgs/${slug}`,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        images: [ogImage],
      },
    };
  }

  const title = `${data.org.name} | OpenShelf`;
  const description = data.org.description ?? "OpenShelf の組織ページ";
  const ogImage = buildOgImageUrl(
    data.org.name,
    data.org.description ?? undefined,
  );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_BASE}/orgs/${slug}`,
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

export default async function OrgPage(props: {
  params: Params | Promise<Params>;
}) {
  const { slug } = await Promise.resolve(props.params);
  return <OrgPageClient slug={slug} />;
}
