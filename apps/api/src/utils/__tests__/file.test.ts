import { describe, expect, it } from "vitest";
import { validateMagicNumbers } from "../file";

function createFile(name: string, type: string, bytes: Uint8Array) {
    return new File([Uint8Array.from(bytes)], name, { type });
}

function withText(bytes: number[], text: string) {
    const textBytes = new TextEncoder().encode(text);
    return new Uint8Array([...bytes, ...textBytes]);
}

function createMinimalZip(filename: string): Uint8Array {
    const filenameBytes = new TextEncoder().encode(filename);
    const filenameLen = filenameBytes.length;

    const cdSize = 46 + filenameLen;
    const cdOffset = 0; // In this minimal zip, we don't even need local file headers for our parser

    // Central Directory Entry
    const cdRecord = new Uint8Array(cdSize);
    const cdView = new DataView(cdRecord.buffer);
    cdView.setUint32(0, 0x02014b50, true); // Signature
    cdView.setUint16(28, filenameLen, true); // Filename length
    cdRecord.set(filenameBytes, 46); // Filename

    // End of Central Directory Record
    const eocdRecord = new Uint8Array(22);
    const eocdView = new DataView(eocdRecord.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // Signature
    eocdView.setUint16(8, 1, true); // Number of CD records
    eocdView.setUint16(10, 1, true); // Total number of CD records
    eocdView.setUint32(12, cdSize, true); // Size of central directory
    eocdView.setUint32(16, cdOffset + 8, true); // Offset of start of central directory

    const zipBytes = new Uint8Array(cdSize + 22 + 8);
    // Add magic numbers at the beginning
    zipBytes.set([0x50, 0x4b, 0x03, 0x04], 0);
    zipBytes.set(cdRecord, 8);
    zipBytes.set(eocdRecord, 8 + cdSize);

    return zipBytes;
}

function createMinimalOle2(streamName: string): Uint8Array {
    const sectorSize = 512; // 1 << 9
    const totalSize = 512 + sectorSize * 2; // header + 1 fat sector + 1 dir sector
    const bytes = new Uint8Array(totalSize);
    const view = new DataView(bytes.buffer);

    // Header
    view.setUint32(0, 0xE011CFD0, true); // Magic D0 CF 11 E0
    view.setUint32(4, 0xE11AB1A1, true); // Magic A1 B1 1A E1
    view.setUint16(30, 9, true); // Sector shift (512 bytes)
    view.setUint32(44, 1, true); // Number of FAT sectors
    view.setUint32(48, 1, true); // First directory sector (sector 1)
    view.setUint32(76, 0, true); // First FAT sector is at sector 0
    for(let i=1; i<109; i++) {
        view.setUint32(76 + i*4, 0xFFFFFFFF, true);
    }

    // FAT Sector (Sector 0: offset 512)
    const fatOffset = 512;
    view.setUint32(fatOffset, 0xFFFFFFFE, true); // FAT[0] = ENDOFCHAIN (used for FAT itself)
    view.setUint32(fatOffset + 4, 0xFFFFFFFE, true); // FAT[1] = ENDOFCHAIN (used for Dir)

    // Directory Sector (Sector 1: offset 1024)
    const dirOffset = 1024;

    // Directory Entry 0
    const streamNameBytes = toUtf16Le(streamName + "\0");
    bytes.set(streamNameBytes, dirOffset);
    view.setUint16(dirOffset + 64, streamNameBytes.length, true); // Name length

    return bytes;
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

        await expect(validateMagicNumbers(pdf, "application/pdf")).resolves.toBe(true);
    });

    it("rejects files whose magic number does not match the declared type", async () => {
        const fakePdf = createFile(
            "paper.pdf",
            "application/pdf",
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );

        await expect(validateMagicNumbers(fakePdf, "application/pdf")).resolves.toBe(false);
    });

    it("accepts PPTX files only when the presentation entry exists", async () => {
        const pptx = createFile(
            "slides.pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            createMinimalZip("ppt/presentation.xml"),
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
            createMinimalZip("word/document.xml"),
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
            createMinimalOle2("PowerPoint Document"),
        );

        await expect(validateMagicNumbers(ppt, "application/vnd.ms-powerpoint")).resolves.toBe(true);
    });

    it("rejects files with unknown signatures", async () => {
        const file = createFile(
            "notes.bin",
            "application/octet-stream",
            new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        );

        await expect(validateMagicNumbers(file, "application/octet-stream")).resolves.toBe(false);
    });
});
