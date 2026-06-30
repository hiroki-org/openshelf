import { describe, expect, it } from "vitest";
import { validateMagicNumbers } from "../file";

function createMockZip(entries: string[]) {
  const parts: Uint8Array[] = [];
  parts.push(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

  const cdOffset = 4;
  let cdSize = 0;
  const cdParts: Uint8Array[] = [];

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry);
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(cdEntry.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(28, nameBytes.length, true);
    cdEntry.set(nameBytes, 46);

    cdParts.push(cdEntry);
    cdSize += cdEntry.length;
  }

  parts.push(...cdParts);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);

  parts.push(eocd);

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }

  return result;
}

function createMockOle2(streams: string[]) {
  const buffer = new Uint8Array(1536);
  const view = new DataView(buffer.buffer);

  const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  magic.forEach((b, i) => view.setUint8(i, b));
  view.setUint16(30, 9, true);
  view.setUint32(44, 1, true);
  view.setUint32(48, 1, true);

  view.setUint32(116, 0, true);
  for (let i = 1; i < 109; i++) {
    view.setUint32(116 + i * 4, 0xffffffff, true);
  }

  view.setUint32(512 + 0, 0xffffffff, true);
  view.setUint32(512 + 4, 0xfffffffe, true);
  for (let i = 2; i < 128; i++) {
    view.setUint32(512 + i * 4, 0xffffffff, true);
  }

  for (let i = 0; i < streams.length && i < 4; i++) {
    const stream = streams[i];
    const entryOffset = 1024 + i * 128;

    for (let j = 0; j < stream.length; j++) {
      view.setUint16(entryOffset + j * 2, stream.charCodeAt(j), true);
    }
    view.setUint16(entryOffset + stream.length * 2, 0, true);
    view.setUint16(entryOffset + 64, (stream.length + 1) * 2, true);
    view.setUint8(entryOffset + 66, stream === "non_stream" ? 1 : 2);
  }

  return buffer;
}

function createFile(name: string, type: string, bytes: Uint8Array) {
  return new File([Uint8Array.from(bytes)], name, { type });
}

describe("validateMagicNumbers", () => {
  it.each([
    {
      label: "PDF",
      file: createFile(
        "paper.pdf",
        "application/pdf",
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
      ),
      declaredMime: "application/pdf",
    },
    {
      label: "PNG",
      file: createFile(
        "cover.png",
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
      declaredMime: "image/png",
    },
    {
      label: "JPEG",
      file: createFile(
        "photo.jpg",
        "image/jpeg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xdb]),
      ),
      declaredMime: "image/jpeg",
    },
  ])("accepts valid $label files", async ({ file, declaredMime }) => {
    await expect(validateMagicNumbers(file, declaredMime)).resolves.toBe(true);
  });

  it("rejects files whose magic number does not match the declared type", async () => {
    const fakePdf = createFile(
      "paper.pdf",
      "application/pdf",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    await expect(
      validateMagicNumbers(fakePdf, "application/pdf"),
    ).resolves.toBe(false);
  });

  it("accepts PPTX files only when the presentation entry exists", async () => {
    const pptx = createFile(
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      createMockZip(["ppt/presentation.xml"]),
    );

    await expect(
      validateMagicNumbers(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).resolves.toBe(true);
  });

  it("rejects PPTX files that do not contain the presentation entry", async () => {
    const pptx = createFile(
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      createMockZip(["word/document.xml"]),
    );

    await expect(
      validateMagicNumbers(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).resolves.toBe(false);
  });

  it("accepts legacy PowerPoint files when the OLE payload contains the document marker", async () => {
    const ppt = createFile(
      "slides.ppt",
      "application/vnd.ms-powerpoint",
      createMockOle2(["PowerPoint Document"]),
    );

    await expect(
      validateMagicNumbers(ppt, "application/vnd.ms-powerpoint"),
    ).resolves.toBe(true);
  });

  it("rejects files with unknown signatures", async () => {
    const file = createFile(
      "notes.bin",
      "application/octet-stream",
      new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    );

    await expect(
      validateMagicNumbers(file, "application/octet-stream"),
    ).resolves.toBe(false);
  });

  it("rejects files whose content ends before a full signature match", async () => {
    const truncatedPng = createFile(
      "cover.png",
      "image/png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );

    await expect(validateMagicNumbers(truncatedPng, "image/png")).resolves.toBe(
      false,
    );
  });

  it("rejects legacy PowerPoint files when the target entry is not a stream (objectType !== 2)", async () => {
    const ppt = createFile(
      "slides.ppt",
      "application/vnd.ms-powerpoint",
      createMockOle2(["non_stream"]),
    );
    // Overwrite the stream name in the buffer to match "PowerPoint Document"
    // but keep the objectType as 1 (storage) set by our updated mock
    const buffer = new Uint8Array(await ppt.arrayBuffer());
    const view = new DataView(buffer.buffer);
    const targetStream = "PowerPoint Document";
    const entryOffset = 1024 + 0 * 128; // First entry

    for (let j = 0; j < targetStream.length; j++) {
      view.setUint16(entryOffset + j * 2, targetStream.charCodeAt(j), true);
    }
    view.setUint16(entryOffset + targetStream.length * 2, 0, true);
    view.setUint16(entryOffset + 64, (targetStream.length + 1) * 2, true);
    // Ensure objectType is still 1
    view.setUint8(entryOffset + 66, 1);

    const modifiedPpt = new File([buffer], "slides.ppt", {
      type: "application/vnd.ms-powerpoint",
    });

    await expect(
      validateMagicNumbers(modifiedPpt, "application/vnd.ms-powerpoint"),
    ).resolves.toBe(false);
  });

it("returns false when File.slice throws RangeError", async () => {
    const errorFile = {
      slice: () => ({
        arrayBuffer: async () => {
          throw new RangeError("Invalid range");
        },
      }),
      size: 100,
      type: "application/pdf",
    } as unknown as File;

    await expect(validateMagicNumbers(errorFile, "application/pdf")).resolves.toBe(false);
  });

it("returns false when File.slice throws TypeError", async () => {
    const errorFile = {
      slice: () => ({
        arrayBuffer: async () => {
          throw new TypeError("Type error");
        },
      }),
      size: 100,
      type: "application/pdf",
    } as unknown as File;

    await expect(validateMagicNumbers(errorFile, "application/pdf")).resolves.toBe(false);
  });

it("returns false when File.slice throws DOMException with InvalidStateError", async () => {
    const errorFile = {
      slice: () => ({
        arrayBuffer: async () => {
          throw new DOMException("Invalid state", "InvalidStateError");
        },
      }),
      size: 100,
      type: "application/pdf",
    } as unknown as File;

    await expect(validateMagicNumbers(errorFile, "application/pdf")).resolves.toBe(false);
  });

it("throws the error when File.slice throws an unexpected error", async () => {
    const customError = new Error("Unexpected error");
    const errorFile = {
      slice: () => ({
        arrayBuffer: async () => {
          throw customError;
        },
      }),
      size: 100,
      type: "application/pdf",
    } as unknown as File;

    await expect(validateMagicNumbers(errorFile, "application/pdf")).rejects.toThrow("Unexpected error");
  });

  it("throws the error when File.slice throws DOMException with AbortError", async () => {
    const customError = new DOMException("Aborted", "AbortError");
    const errorFile = {
      slice: () => ({
        arrayBuffer: async () => {
          throw customError;
        },
      }),
      size: 100,
      type: "application/pdf",
    } as unknown as File;

    await expect(validateMagicNumbers(errorFile, "application/pdf")).rejects.toThrow(customError);
  });
});

  it("handles out of bounds cleanly during directory traversal", async () => {
    // We create a mock OLE file that says it has a directory sector, but the file size is too small.
    const buffer = new Uint8Array(1024);
    const view = new DataView(buffer.buffer);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    magic.forEach((b, i) => view.setUint8(i, b));
    view.setUint16(30, 9, true); // 512 byte sectors
    view.setUint32(44, 1, true); // fat sectors count
    view.setUint32(48, 1, true); // dir sector (starts at sector 1 -> offset 1024)

    view.setUint32(76, 0, true); // first fat sector at 0 -> offset 512

    // But file size is 1024, so sector 1 (offset 1024) is out of bounds!
    const file = new File([buffer], "out_of_bounds.ppt", {
      type: "application/vnd.ms-powerpoint",
    });

    await expect(validateMagicNumbers(file, "application/vnd.ms-powerpoint")).resolves.toBe(false);
  });

  it("handles MAX_DIR_SECTORS correctly", async () => {
    // Generate a mock OLE file that just loops FAT
    const buffer = new Uint8Array(1024 + 1024 * 512); // Large file
    const view = new DataView(buffer.buffer);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    magic.forEach((b, i) => view.setUint8(i, b));
    view.setUint16(30, 9, true);
    view.setUint32(44, 1, true);
    view.setUint32(48, 1, true);
    view.setUint32(76, 0, true);

    // Point fat sector to next
    for (let i = 1; i < 1100; i++) {
       view.setUint32(512 + (i-1)*4, i, true);
    }
    view.setUint32(512 + 1099*4, 0xfffffffe, true); // End chain

    const file = new File([buffer], "max_sectors.ppt", {
      type: "application/vnd.ms-powerpoint",
    });

    await expect(validateMagicNumbers(file, "application/vnd.ms-powerpoint")).resolves.toBe(false);
  });

  it("handles objectType === 2 but mismatched name properly", async () => {
    // Generate a mock OLE file with a stream object that has a different name
    const buffer = new Uint8Array(1536);
    const view = new DataView(buffer.buffer);
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    magic.forEach((b, i) => view.setUint8(i, b));
    view.setUint16(30, 9, true);
    view.setUint32(44, 1, true);
    view.setUint32(48, 1, true);
    view.setUint32(76, 0, true);

    view.setUint32(512 + 0, 0xffffffff, true);
    view.setUint32(512 + 4, 0xfffffffe, true);

    const stream = "Wrong Stream Name";
    const entryOffset = 1024 + 0 * 128;

    for (let j = 0; j < stream.length; j++) {
      view.setUint16(entryOffset + j * 2, stream.charCodeAt(j), true);
    }
    view.setUint16(entryOffset + stream.length * 2, 0, true);
    // But set the length exactly to what PowerPoint Document would have, so the match loop runs and fails!
    const targetLength = ("PowerPoint Document".length + 1) * 2;
    view.setUint16(entryOffset + 64, targetLength, true);
    view.setUint8(entryOffset + 66, 2); // stream

    const file = new File([buffer], "wrong_name.ppt", {
      type: "application/vnd.ms-powerpoint",
    });

    await expect(validateMagicNumbers(file, "application/vnd.ms-powerpoint")).resolves.toBe(false);
  });
