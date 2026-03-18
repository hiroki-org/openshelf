import { ImageResponse } from "next/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.17/files/inter-latin-800-normal.woff";

const BADGE_LABELS: Record<string, string> = {
  paper: "Paper",
  org: "Organization",
  collection: "Collection",
};

const fontDataPromise = fetch(FONT_URL)
  .then((response) => (response.ok ? response.arrayBuffer() : null))
  .catch(() => null);

function truncateTitle(value: string, maxLength = 80): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const chars = [...normalized];
  if (chars.length <= maxLength) return normalized;
  return `${chars.slice(0, maxLength).join("")}...`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "paper";
  const title = searchParams.get("title") ?? "OpenShelf";
  const subtitle = searchParams.get("subtitle") ?? "";
  const safeTitle = truncateTitle(title, 80);
  const safeSubtitle = truncateTitle(subtitle, 110);
  const fontData = await fontDataPromise;

  const badgeLabel = Object.hasOwn(BADGE_LABELS, type)
    ? BADGE_LABELS[type]
    : "Paper";

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px",
        border: "2px solid #e5e7eb",
        fontFamily: "OpenShelfSans, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 28,
          color: "#4b5563",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 800 }}>OpenShelf</div>
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 9999,
            padding: "8px 18px",
            fontSize: 20,
            color: "#6b7280",
          }}
        >
          {badgeLabel}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1.2,
          }}
        >
          {safeTitle}
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#4b5563",
            lineHeight: 1.3,
          }}
        >
          {safeSubtitle || "Research artifacts hosting and sharing"}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fontData
        ? [
            {
              name: "OpenShelfSans",
              data: fontData,
              weight: 800,
              style: "normal",
            },
          ]
        : undefined,
    },
  );

  image.headers.set("Cache-Control", "public, max-age=0, s-maxage=86400");
  return image;
}
