import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PptxViewer } from "../pptx-viewer";

const mockApiFetch = vi.fn();
const pptxMimeType =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const textEncoder = new TextEncoder();

type ZipEntry = {
  name: string;
  method: number;
  data: Uint8Array;
  localHeaderOffsetOverride?: number | "central";
  compressedSizeOverride?: number;
};

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

function u16LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value, true);
  return new Uint8Array(buffer);
}

function u32LE(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return new Uint8Array(buffer);
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const localSegments: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const compressedSize = entry.compressedSizeOverride ?? entry.data.length;
    const localSegment = concatBytes(
      u32LE(0x04034b50),
      u16LE(20),
      u16LE(0),
      u16LE(entry.method),
      u16LE(0),
      u16LE(0),
      u32LE(0),
      u32LE(compressedSize),
      u32LE(entry.data.length),
      u16LE(nameBytes.length),
      u16LE(0),
      nameBytes,
      entry.data,
    );

    localSegments.push(localSegment);
    localOffsets.push(localOffset);
    localOffset += localSegment.length;
  }

  const centralSegments: Uint8Array[] = [];
  let centralSize = 0;
  entries.forEach((entry, index) => {
    const nameBytes = textEncoder.encode(entry.name);
    const compressedSize = entry.compressedSizeOverride ?? entry.data.length;
    const centralSegment = concatBytes(
      u32LE(0x02014b50),
      u16LE(20),
      u16LE(20),
      u16LE(0),
      u16LE(entry.method),
      u16LE(0),
      u16LE(0),
      u32LE(0),
      u32LE(compressedSize),
      u32LE(entry.data.length),
      u16LE(nameBytes.length),
      u16LE(0),
      u16LE(0),
      u16LE(0),
      u16LE(0),
      u32LE(0),
      u32LE(
        entry.localHeaderOffsetOverride === "central"
          ? localOffset
          : entry.localHeaderOffsetOverride ?? localOffsets[index],
      ),
      nameBytes,
    );

    centralSegments.push(centralSegment);
    centralSize += centralSegment.length;
  });

  const eocd = concatBytes(
    u32LE(0x06054b50),
    u16LE(0),
    u16LE(0),
    u16LE(entries.length),
    u16LE(entries.length),
    u32LE(centralSize),
    u32LE(localOffset),
    u16LE(0),
  );

  return concatBytes(...localSegments, ...centralSegments, eocd);
}

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("PptxViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders extracted slide text and supports paging", async () => {
    const pptxPath = path.resolve(
      __dirname,
      "../../../../e2e/fixtures/test-slides.pptx",
    );
    const pptxBuffer = fs.readFileSync(pptxPath);

    mockApiFetch.mockResolvedValueOnce(
      new Response(pptxBuffer, {
        status: 200,
        headers: { "Content-Type": pptxMimeType },
      }),
    );

    render(<PptxViewer fileUrl="/api/downloads/slides.pptx" />);

    await screen.findByText("Slide 1");
    expect(screen.getByText("OpenShelf PPTX Preview 1")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await screen.findByText("Slide 2");
    expect(screen.getByText("OpenShelf PPTX Preview 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "前へ" }));
    await screen.findByText("Slide 1");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/downloads/slides.pptx",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows fallback UI and calls download fallback on invalid archive", async () => {
    const onDownloadFallback = vi.fn();

    mockApiFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), {
        status: 200,
        headers: { "Content-Type": pptxMimeType },
      }),
    );

    render(
      <PptxViewer
        fileUrl="/api/downloads/broken.pptx"
        onDownloadFallback={onDownloadFallback}
      />,
    );

    await screen.findByText("PPTXプレビューを読み込めません");
    fireEvent.click(screen.getByRole("button", { name: "ダウンロードする" }));
    await waitFor(() => {
      expect(onDownloadFallback).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a download link fallback when no handler is provided", async () => {
    mockApiFetch.mockResolvedValueOnce(
      new Response(buildZip([]), {
        status: 200,
        headers: { "Content-Type": pptxMimeType },
      }),
    );

    render(<PptxViewer fileUrl="/api/downloads/empty.pptx" />);

    await screen.findByText("PPTXプレビューを読み込めません");
    expect(
      screen.getByRole("link", { name: "ダウンロードする" }),
    ).toHaveAttribute("href", "/api/downloads/empty.pptx");
  });

  it("renders readable slides while skipping malformed zip entries", async () => {
    const validSlideXml = textEncoder.encode(
      '<root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>OpenShelf PPTX Preview 1</a:t></root>',
    );
    const ignoredXml = textEncoder.encode(
      '<root xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Ignored slide</a:t></root>',
    );
    const buffer = buildZip([
      {
        name: "ppt/slides/slide1.xml",
        method: 0,
        data: validSlideXml,
      },
      {
        name: "ppt/slides/slide2.xml",
        method: 0,
        data: ignoredXml,
        localHeaderOffsetOverride: 999999,
      },
      {
        name: "ppt/slides/slide3.xml",
        method: 0,
        data: ignoredXml,
        localHeaderOffsetOverride: "central",
      },
      {
        name: "ppt/slides/slide4.xml",
        method: 0,
        data: ignoredXml,
        compressedSizeOverride: 1_000_000,
      },
      {
        name: "ppt/slides/slide5.xml",
        method: 99,
        data: ignoredXml,
      },
    ]);

    mockApiFetch.mockResolvedValueOnce(
      new Response(buffer, {
        status: 200,
        headers: { "Content-Type": pptxMimeType },
      }),
    );

    render(<PptxViewer fileUrl="/api/downloads/mixed.pptx" />);

    await screen.findByText("Slide 1");
    expect(screen.getByText("OpenShelf PPTX Preview 1")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });
});
