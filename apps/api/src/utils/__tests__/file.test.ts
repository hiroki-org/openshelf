import { describe, expect, it } from "vitest";
import { validateMagicNumbers, searchSequenceInFile, CHUNK_SIZE } from "../file";

function createFile(name: string, type: string, bytes: Uint8Array) {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function withText(bytes: number[], text: string) {
  const textBytes = new TextEncoder().encode(text);
  return new Uint8Array([...bytes, ...textBytes]);
}

function toUtf16Le(text: string) {
  const bytes = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index++) {
    bytes[index * 2] = text.charCodeAt(index);
    bytes[index * 2 + 1] = 0;
  }
  return bytes;
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
      withText([0x50, 0x4b, 0x03, 0x04], "ppt/presentation.xml"),
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
      withText([0x50, 0x4b, 0x03, 0x04], "word/document.xml"),
    );

    await expect(
      validateMagicNumbers(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).resolves.toBe(false);
  });

  it("accepts legacy PowerPoint files when the OLE payload contains the document marker", async () => {
    const header = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
    ]);
    const ppt = createFile(
      "slides.ppt",
      "application/vnd.ms-powerpoint",
      new Uint8Array([...header, ...toUtf16Le("PowerPoint Document")]),
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

  it("accepts files where the required sequence follows a partial match", async () => {
    const pptx = createFile(
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      withText(
        [0x50, 0x4b, 0x03, 0x04],
        "ppt/present_NOPE... ppt/presentation.xml",
      ),
    );

    await expect(
      validateMagicNumbers(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).resolves.toBe(true);
  });

  it("rejects files where a partial match is not followed by the full sequence", async () => {
    const pptx = createFile(
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      withText([0x50, 0x4b, 0x03, 0x04], "ppt/present_NOPE..."),
    );

    await expect(
      validateMagicNumbers(
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).resolves.toBe(false);
  });
});


describe("searchSequenceInFile", () => {
    it("returns false when search bytes are empty", async () => {
        const file = createFile("empty.bin", "application/octet-stream", new Uint8Array([1, 2, 3]));
        const searchBytes = new Uint8Array([]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(false);
    });

    it("finds a sequence at the beginning of the file", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]));
        const searchBytes = new Uint8Array([0xAA, 0xBB]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("finds a sequence in the middle of a chunk", async () => {
        const content = new Uint8Array(100);
        content.set([0xAA, 0xBB, 0xCC], 50);
        const file = createFile("test.bin", "application/octet-stream", content);
        const searchBytes = new Uint8Array([0xAA, 0xBB, 0xCC]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("finds a sequence crossing chunk boundaries", async () => {
        const fileSize = CHUNK_SIZE + 1024;
        const bytes = new Uint8Array(fileSize);
        const searchBytes = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);

        // The boundary is at index CHUNK_SIZE
        // Place search bytes so it spans the boundary
        bytes.set(searchBytes, CHUNK_SIZE - 2); // 2 bytes before, 2 bytes after

        const file = createFile("test.bin", "application/octet-stream", bytes);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("finds a sequence in the second chunk", async () => {
        const fileSize = CHUNK_SIZE * 2 + 512; // ~2.5MB
        const bytes = new Uint8Array(fileSize);
        const searchBytes = new Uint8Array([0xEE, 0xFF, 0x00, 0x11]);

        bytes.set(searchBytes, CHUNK_SIZE + 500);

        const file = createFile("test.bin", "application/octet-stream", bytes);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("returns false when the sequence is not in the file", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([1, 2, 3, 4, 5]));
        const searchBytes = new Uint8Array([0xAA, 0xBB]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(false);
    });
});
