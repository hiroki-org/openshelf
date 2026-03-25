"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type PptxViewerProps = {
  fileUrl: string;
  onDownloadFallback?: () => void;
};

type SlideText = {
  index: number;
  lines: string[];
};

const LFH_SIGNATURE = 0x04034b50;
const CEN_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const SLIDE_PATH_PATTERN = /^ppt\/slides\/slide(\d+)\.xml$/;
const utf8Decoder = new TextDecoder("utf-8");

function decodeBytes(bytes: Uint8Array): string {
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function extractSlideText(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    return [];
  }

  const textNodes = Array.from(doc.getElementsByTagName("a:t"));
  return textNodes
    .map((node) => node.textContent?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function getUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function getUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function inflateDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const chunk = new Uint8Array(data.byteLength);
  chunk.set(data);
  const source = new Response(chunk).body;
  if (!source) {
    return new Uint8Array();
  }
  const decompressed = await new Response(
    source.pipeThrough(new DecompressionStream("deflate-raw")),
  ).arrayBuffer();
  return new Uint8Array(decompressed);
}

async function parsePptxSlides(buffer: ArrayBuffer): Promise<SlideText[]> {
  const bytes = new Uint8Array(buffer);
  const slidesByIndex = new Map<number, string[]>();
  const minEocdOffset = Math.max(0, bytes.length - 22 - 65535);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= minEocdOffset; offset -= 1) {
    if (getUint32LE(bytes, offset) === EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("zip end-of-central-directory not found");
  }

  const totalEntries = getUint16LE(bytes, eocdOffset + 10);
  const centralDirectoryOffset = getUint32LE(bytes, eocdOffset + 16);
  let cursor = centralDirectoryOffset;

  for (let entry = 0; entry < totalEntries; entry += 1) {
    if (cursor + 46 > bytes.length) break;
    if (getUint32LE(bytes, cursor) !== CEN_SIGNATURE) break;

    const method = getUint16LE(bytes, cursor + 10);
    const compressedSize = getUint32LE(bytes, cursor + 20);
    const fileNameLength = getUint16LE(bytes, cursor + 28);
    const extraLength = getUint16LE(bytes, cursor + 30);
    const commentLength = getUint16LE(bytes, cursor + 32);
    const localHeaderOffset = getUint32LE(bytes, cursor + 42);

    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > bytes.length) break;
    const fileName = decodeBytes(bytes.slice(fileNameStart, fileNameEnd));
    const match = fileName.match(SLIDE_PATH_PATTERN);

    if (match) {
      const index = Number(match[1]);
      if (localHeaderOffset + 30 > bytes.length) {
        cursor = fileNameEnd + extraLength + commentLength;
        continue;
      }
      if (getUint32LE(bytes, localHeaderOffset) !== LFH_SIGNATURE) {
        cursor = fileNameEnd + extraLength + commentLength;
        continue;
      }

      const localNameLength = getUint16LE(bytes, localHeaderOffset + 26);
      const localExtraLength = getUint16LE(bytes, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) {
        cursor = fileNameEnd + extraLength + commentLength;
        continue;
      }

      const compressedData = bytes.slice(dataStart, dataEnd);
      let xmlBytes: Uint8Array = new Uint8Array();
      if (method === 0) {
        xmlBytes = compressedData;
      } else if (method === 8) {
        xmlBytes = await inflateDeflateRaw(compressedData);
      }

      const xml = decodeBytes(xmlBytes);
      const lines = extractSlideText(xml);
      slidesByIndex.set(
        index,
        lines.length > 0 ? lines : ["（このスライドに抽出可能なテキストはありません）"],
      );
    }

    cursor = fileNameEnd + extraLength + commentLength;
  }

  const slideIndexes = Array.from(slidesByIndex.keys()).sort((a, b) => a - b);
  if (slideIndexes.length === 0) {
    throw new Error("pptx has no readable slide xml");
  }

  return slideIndexes.map((index) => ({
    index,
    lines: slidesByIndex.get(index) ?? ["（内容を読み取れません）"],
  }));
}

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

async function fetchPptxBuffer(fileUrl: string): Promise<ArrayBuffer> {
  const response = isAbsoluteUrl(fileUrl)
    ? await fetch(fileUrl)
    : await apiFetch(fileUrl);

  if (!response.ok) {
    throw new Error(`failed to fetch pptx: ${response.status}`);
  }

  return response.arrayBuffer();
}

export function PptxViewer({ fileUrl, onDownloadFallback }: PptxViewerProps) {
  const [slides, setSlides] = useState<SlideText[]>([]);
  const [slideNumber, setSlideNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setSlides([]);
    setSlideNumber(1);
    setLoading(true);
    setLoadError(false);

    const run = async () => {
      try {
        const buffer = await fetchPptxBuffer(fileUrl);
        const parsedSlides = await parsePptxSlides(buffer);
        if (cancelled) return;
        setSlides(parsedSlides);
      } catch (error) {
        if (cancelled) return;
        console.error("PPTXプレビューの読み込みに失敗しました:", error);
        setLoadError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const totalSlides = slides.length;
  const canPrev = slideNumber > 1;
  const canNext = slideNumber < totalSlides;
  const currentSlide = useMemo(
    () => (slideNumber > 0 ? slides[slideNumber - 1] : undefined),
    [slides, slideNumber],
  );

  return (
    <div
      data-testid="pptx-viewer"
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSlideNumber((value) => Math.max(1, value - 1))}
            disabled={!canPrev}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            前へ
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {slideNumber} / {totalSlides || "-"}
          </span>
          <button
            type="button"
            onClick={() =>
              setSlideNumber((value) => Math.min(totalSlides, value + 1))
            }
            disabled={!canNext}
            className="rounded border border-gray-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
          >
            次へ
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          テキストベースのスライドプレビュー
        </p>
      </div>

      <div
        data-testid="pptx-slide-surface"
        className="flex min-h-[320px] flex-col justify-start overflow-auto rounded bg-gray-50 p-4 dark:bg-gray-950 sm:min-h-[420px]"
      >
        {loading && (
          <div className="h-[260px] w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        )}

        {!loading && loadError && (
          <div className="text-center text-sm text-red-600">
            <p>PPTXプレビューを読み込めません</p>
            {onDownloadFallback ? (
              <button
                type="button"
                className="underline"
                onClick={onDownloadFallback}
              >
                ダウンロードする
              </button>
            ) : (
              <a
                className="underline"
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ダウンロードする
              </a>
            )}
          </div>
        )}

        {!loading && !loadError && currentSlide && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-900">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Slide {currentSlide.index}
            </h4>
            <div className="space-y-2 text-sm leading-6 text-gray-800 dark:text-gray-100">
              {currentSlide.lines.map((line, index) => (
                <p key={`${currentSlide.index}-${index}`}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
