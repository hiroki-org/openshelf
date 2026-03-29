import { describe, expect, it } from "vitest";
import { validateMagicNumbers } from "../file";

function createFile(name: string, type: string, bytes: Uint8Array) {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function createZipWithFile(filename: string) {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(filename);

  // EOCD (22 bytes)
  // 50 4b 05 06, disk 0, cd disk 0, 1 entry, 1 entry total, cd size, cd offset, comment len 0
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true); // disk
  eocdView.setUint16(6, 0, true); // cd disk
  eocdView.setUint16(8, 1, true); // num entries on disk
  eocdView.setUint16(10, 1, true); // num entries

  // Central Directory Header (46 bytes + name len)
  // 50 4b 01 02
  const cd = new Uint8Array(46 + nameBytes.length);
  const cdView = new DataView(cd.buffer);
  cdView.setUint32(0, 0x02014b50, true);
  cdView.setUint16(28, nameBytes.length, true); // file name length
  cd.set(nameBytes, 46);

  // Create Local File Header (just a dummy for magic number validation)
  const lfh = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

  // Set CD size and offset in EOCD
  eocdView.setUint32(12, cd.length, true); // cd size
  eocdView.setUint32(16, lfh.length, true); // cd offset

  const combined = new Uint8Array(lfh.length + cd.length + eocd.length);
  combined.set(lfh, 0);
  combined.set(cd, lfh.length);
  combined.set(eocd, lfh.length + cd.length);

  return combined;
}

function createOleWithStream(streamName: string) {
  // Header (512 bytes)
  const header = new Uint8Array(512);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, 0xd0cf11e0, false);
  headerView.setUint32(4, 0xa1b11ae1, false);
  headerView.setUint16(30, 9, true); // sector shift (512 bytes)
  headerView.setUint32(48, 0, true); // first dir sector

  // Directory Sector (512 bytes)
  const dir = new Uint8Array(512);
  const dirView = new DataView(dir.buffer);

  // Stream name in UTF-16LE
  const expectedLen = streamName.length * 2 + 2;
  for (let i = 0; i < streamName.length; i++) {
    dirView.setUint16(i * 2, streamName.charCodeAt(i), true);
  }
  dirView.setUint16(64, expectedLen, true); // name length

  const combined = new Uint8Array(header.length + dir.length);
  combined.set(header, 0);
  combined.set(dir, header.length);

  return combined;
}

describe("validateMagicNumbers", () => {
  it("accepts valid PDF files", async () => {
    const pdf = createFile(
      "paper.pdf",
      "application/pdf",
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
    );

    await expect(validateMagicNumbers(pdf, "application/pdf")).resolves.toBe(
      true,
    );
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
      createZipWithFile("ppt/presentation.xml"),
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
      createZipWithFile("word/document.xml"),
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
      createOleWithStream("PowerPoint Document"),
    );

    await expect(
      validateMagicNumbers(ppt, "application/vnd.ms-powerpoint"),
    ).resolves.toBe(true);
  });

  it("rejects legacy PowerPoint files when the PowerPoint Document stream is missing", async () => {
    const ppt = createFile(
      "slides.ppt",
      "application/vnd.ms-powerpoint",
      createOleWithStream("WordDocument"), // Different stream name
    );

    await expect(
      validateMagicNumbers(ppt, "application/vnd.ms-powerpoint"),
    ).resolves.toBe(false);
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
});
