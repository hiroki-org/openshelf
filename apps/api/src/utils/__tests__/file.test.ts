import { describe, expect, it } from "vitest";
import { validateMagicNumbers } from "../file";

describe("validateMagicNumbers", () => {
    // Helper: Create a File with given bytes at the start
    function createFileWithMagic(magic: Uint8Array, totalSize: number = 1000): File {
        const buffer = new ArrayBuffer(totalSize);
        const view = new Uint8Array(buffer);
        magic.forEach((byte, i) => {
            view[i] = byte;
        });
        return new File([buffer], "test.bin", { type: "application/octet-stream" });
    }

    describe("PDF validation", () => {
        it("should validate a PDF file with correct magic number", async () => {
            // PDF magic: %PDF- (0x25 0x50 0x44 0x46 0x2D)
            const magic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["application/pdf"]);
            expect(result).toBe(true);
        });

        it("should reject non-PDF file claimed as PDF", async () => {
            // PNG magic
            const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["application/pdf"]);
            expect(result).toBe(false);
        });

        it("should reject file with no recognized magic number", async () => {
            const magic = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["application/pdf"]);
            expect(result).toBe(false);
        });
    });

    describe("PNG validation", () => {
        it("should validate a PNG file with correct magic number", async () => {
            // PNG magic: 89 50 4E 47 0D 0A 1A 0A
            const magic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["image/png"]);
            expect(result).toBe(true);
        });

        it("should reject JPEG file claimed as PNG", async () => {
            // JPEG magic
            const magic = new Uint8Array([0xff, 0xd8, 0xff]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["image/png"]);
            expect(result).toBe(false);
        });
    });

    describe("JPEG validation", () => {
        it("should validate a JPEG file with correct magic number", async () => {
            // JPEG magic: FF D8 FF
            const magic = new Uint8Array([0xff, 0xd8, 0xff]);
            const file = createFileWithMagic(magic);
            const result = await validateMagicNumbers(file, ["image/jpeg"]);
            expect(result).toBe(true);
        });
    });

    describe("PPTX deep validation", () => {
        it("should validate PPTX with ppt/presentation.xml deep inside", async () => {
            // ZIP magic (PK) at start
            const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
            const presentationXml = "ppt/presentation.xml";
            const presentationBytes = new TextEncoder().encode(presentationXml);

            // Create buffer with ZIP magic at start and presentation.xml string at offset 500
            const totalSize = 1000;
            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);

            // Write ZIP magic
            zipMagic.forEach((byte, i) => {
                view[i] = byte;
            });

            // Write presentation.xml at offset 500
            presentationBytes.forEach((byte, i) => {
                view[500 + i] = byte;
            });

            const file = new File([buffer], "test.pptx", { type: "application/zip" });
            const result = await validateMagicNumbers(file, ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
            expect(result).toBe(true);
        });

        it("should reject PPTX without ppt/presentation.xml string", async () => {
            // ZIP magic but no presentation.xml
            const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
            const file = createFileWithMagic(zipMagic, 1000);
            const result = await validateMagicNumbers(file, ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
            expect(result).toBe(false);
        });

        it("should handle PPTX files larger than MAX_DEEP_VALIDATION_BYTES", async () => {
            // File larger than 50MB should return false for deep validation (DoS protection)
            const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
            // Create a large file (51MB)
            const largeSize = 51 * 1024 * 1024;
            const buffer = new ArrayBuffer(1000); // Use small actual buffer, but mock File.size
            const view = new Uint8Array(buffer);
            zipMagic.forEach((byte, i) => {
                view[i] = byte;
            });

            // Create file object that reports larger size
            const actualFile = new File([buffer], "large.pptx", { type: "application/zip" });
            Object.defineProperty(actualFile, "size", { value: largeSize });

            const result = await validateMagicNumbers(actualFile, [
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ]);
            expect(result).toBe(false);
        });
    });

    describe("PPT (OLE2) deep validation", () => {
        it("should validate PPT file with PowerPoint Document marker", async () => {
            // OLE2 magic: D0 CF 11 E0 A1 B1 1A E1
            const oleMagic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
            const powerPointText = "PowerPoint Document";

            // Create UTF-16LE encoded version
            const utf16Bytes = new Uint8Array(powerPointText.length * 2);
            for (let i = 0; i < powerPointText.length; i++) {
                utf16Bytes[i * 2] = powerPointText.charCodeAt(i);
                utf16Bytes[i * 2 + 1] = 0;
            }

            // Create buffer with OLE magic at start and PowerPoint Document at offset 500
            const totalSize = 1000;
            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);

            oleMagic.forEach((byte, i) => {
                view[i] = byte;
            });

            utf16Bytes.forEach((byte, i) => {
                view[500 + i] = byte;
            });

            const file = new File([buffer], "test.ppt", { type: "application/x-ole-storage" });
            const result = await validateMagicNumbers(file, ["application/vnd.ms-powerpoint"]);
            expect(result).toBe(true);
        });

        it("should reject PPT without PowerPoint Document marker", async () => {
            // OLE2 magic but no PowerPoint Document string
            const oleMagic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
            const file = createFileWithMagic(oleMagic, 1000);
            const result = await validateMagicNumbers(file, ["application/vnd.ms-powerpoint"]);
            expect(result).toBe(false);
        });

        it("should handle large PPT files with DoS protection", async () => {
            const oleMagic = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
            const buffer = new ArrayBuffer(1000);
            const view = new Uint8Array(buffer);
            oleMagic.forEach((byte, i) => {
                view[i] = byte;
            });

            const actualFile = new File([buffer], "large.ppt", { type: "application/x-ole-storage" });
            Object.defineProperty(actualFile, "size", { value: 51 * 1024 * 1024 });

            const result = await validateMagicNumbers(actualFile, [
                "application/vnd.ms-powerpoint",
            ]);
            expect(result).toBe(false);
        });
    });

    describe("Unknown MIME type", () => {
        it("should reject unknown MIME types even with valid magic numbers", async () => {
            const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
            const file = createFileWithMagic(pdfMagic);
            const result = await validateMagicNumbers(file, ["application/unknown"]);
            expect(result).toBe(false);
        });
    });

    describe("Magic number detection edge cases", () => {
        it("should handle files smaller than magic number size", async () => {
            // File with only 2 bytes (less than typical magic size)
            const buffer = new ArrayBuffer(2);
            const view = new Uint8Array(buffer);
            view[0] = 0x25;
            view[1] = 0x50;
            const file = new File([buffer], "tiny.pdf", { type: "application/pdf" });
            // Should not crash
            const result = await validateMagicNumbers(file, ["application/pdf"]);
            expect(typeof result).toBe("boolean");
        });

        it("should handle empty files", async () => {
            const buffer = new ArrayBuffer(0);
            const file = new File([buffer], "empty.pdf", { type: "application/pdf" });
            const result = await validateMagicNumbers(file, ["application/pdf"]);
            expect(result).toBe(false);
        });
    });

    describe("Chunk boundary handling for deep validation", () => {
        it("should find patterns that span chunk boundaries", async () => {
            // ZIP magic at start
            const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

            // Pattern to find (ppt/presentation.xml)
            const presentationXml = "ppt/presentation.xml";
            const presentationBytes = new TextEncoder().encode(presentationXml);

            // Create buffer where pattern starts near end of first chunk
            // 1MB chunk size, place pattern at 1MB - 5 bytes
            const chunkSize = 1 * 1024 * 1024;
            const patternOffset = chunkSize - 5;
            const totalSize = chunkSize + 100; // Extends into second chunk

            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);

            // Write ZIP magic at start
            zipMagic.forEach((byte, i) => {
                view[i] = byte;
            });

            // Write pattern across chunk boundary
            presentationBytes.forEach((byte, i) => {
                view[patternOffset + i] = byte;
            });

            const file = new File([buffer], "test.pptx", { type: "application/zip" });
            const result = await validateMagicNumbers(file, ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
            expect(result).toBe(true);
        });
    });
});
