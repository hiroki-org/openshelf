import { ImageResponse } from "next/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "paper";
  const title = searchParams.get("title") ?? "OpenShelf";
  const subtitle = searchParams.get("subtitle") ?? "";

  const badgeLabel =
    type === "org"
      ? "Organization"
      : type === "collection"
        ? "Collection"
        : "Paper";

  return new ImageResponse(
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
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#4b5563",
            lineHeight: 1.3,
          }}
        >
          {subtitle || "Research artifacts hosting and sharing"}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}
