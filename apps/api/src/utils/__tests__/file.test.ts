import { describe, expect, it } from "vitest";
import { validateMagicNumbers, searchSequenceInFile } from "../file";

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
        const header = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
        const ppt = createFile(
            "slides.ppt",
            "application/vnd.ms-powerpoint",
            new Uint8Array([...header, ...toUtf16Le("PowerPoint Document")]),
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


describe("searchSequenceInFile", () => {
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

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

    it("finds a sequence in the middle of the file", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]));
        const searchBytes = new Uint8Array([0xCC, 0xDD]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("finds a sequence at the end of the file", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]));
        const searchBytes = new Uint8Array([0xDD, 0xEE]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("returns false if the sequence is not found", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]));
        const searchBytes = new Uint8Array([0xFF, 0x00]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(false);
    });

    it("returns false if partial match is found but not full sequence", async () => {
        const file = createFile("test.bin", "application/octet-stream", new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]));
        const searchBytes = new Uint8Array([0xBB, 0xCC, 0xFF]);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(false);
    });

    it("finds a sequence across chunk boundaries", async () => {
        // Create a file slightly larger than 1MB
        const fileSize = CHUNK_SIZE + 1024;
        const bytes = new Uint8Array(fileSize);

        // Fill with dummy data
        bytes.fill(0x00);

        // Place the search sequence exactly across the chunk boundary
        // The boundary is at index CHUNK_SIZE
        const searchBytes = new Uint8Array([0x11, 0x22, 0x33, 0x44]);

        // Place it so it starts just before the boundary and ends after
        bytes.set(searchBytes, CHUNK_SIZE - 2); // 2 bytes before, 2 bytes after

        const file = createFile("large.bin", "application/octet-stream", bytes);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });

    it("finds a sequence near the very end of a large file", async () => {
        const fileSize = CHUNK_SIZE * 2 + 512; // ~2.5MB
        const bytes = new Uint8Array(fileSize);
        bytes.fill(0xAA);

        const searchBytes = new Uint8Array([0x55, 0x66, 0x77]);
        bytes.set(searchBytes, fileSize - searchBytes.length); // At the very end

        const file = createFile("verylarge.bin", "application/octet-stream", bytes);
        await expect(searchSequenceInFile(file, searchBytes)).resolves.toBe(true);
    });
});
