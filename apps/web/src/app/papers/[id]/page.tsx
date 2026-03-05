import type { Metadata } from "next";
import PaperDetailClient from "./paper-detail-client";

type Params = { id: string };

type PaperMetadataResponse = {
  paper: {
    id: string;
    title: string;
    abstract: string | null;
    visibility: "public" | "org_only" | "private";
  };
  authors: Array<{
    name: string;
    displayName: string | null;
  }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function fetchPaperMetadata(
  id: string,
): Promise<PaperMetadataResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/papers/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PaperMetadataResponse;
  } catch {
    return null;
  }
}

function toDescription(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 200);
}

function buildOgImageUrl(
  type: "paper",
  title: string,
  subtitle?: string,
): string {
  const url = new URL(`${SITE_BASE}/api/og`);
  url.searchParams.set("type", type);
  url.searchParams.set("title", title);
  if (subtitle) {
    url.searchParams.set("subtitle", subtitle);
  }
  return url.toString();
}

export async function generateMetadata(props: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const data = await fetchPaperMetadata(id);

  if (!data || data.paper.visibility !== "public") {
    const genericTitle = "論文詳細 | OpenShelf";
    const ogImage = buildOgImageUrl("paper", genericTitle);
    return {
      title: genericTitle,
      openGraph: {
        title: genericTitle,
        type: "article",
        url: `${SITE_BASE}/papers/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: genericTitle,
        images: [ogImage],
      },
    };
  }

  const title = `${data.paper.title} | OpenShelf`;
  const description =
    toDescription(data.paper.abstract) ?? "OpenShelf の論文詳細ページ";
  const authors = data.authors
    .map((author) => author.displayName ?? author.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const ogImage = buildOgImageUrl(
    "paper",
    data.paper.title,
    authors || undefined,
  );

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${SITE_BASE}/papers/${id}`,
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

export default async function PaperPage(props: { params: Promise<Params> }) {
  const { id } = await props.params;
  return <PaperDetailClient paperId={id} />;
}
