import { describe, expect, it } from "vitest";
import { validateMagicNumbers } from "../file";

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
