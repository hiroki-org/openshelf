const MIME_PDF = "application/pdf";
const MIME_PNG = "image/png";
const MIME_JPEG = "image/jpeg";
const MIME_PPT = "application/vnd.ms-powerpoint";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_OLE2 = "application/x-ole-storage";
const MIME_ZIP = "application/zip";

const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
    [MIME_PDF]: [MIME_PDF],
    [MIME_PNG]: [MIME_PNG],
    [MIME_JPEG]: [MIME_JPEG],
    // PPT/PPTX types require deeper content checks below.
    [MIME_PPT]: [MIME_OLE2],
    [MIME_PPTX]: [MIME_ZIP],
};

const MAGIC_NUMBER_MAP: ReadonlyArray<[string, string]> = [
    ["255044462D", MIME_PDF],
    ["89504E470D0A1A0A", MIME_PNG],
    ["FFD8FF", MIME_JPEG],
    ["D0CF11E0A1B11AE1", MIME_OLE2],
    ["504B0304", MIME_ZIP],
];



// Maximum file size to perform deep content validation.
const MAX_DEEP_VALIDATION_BYTES = 50 * 1024 * 1024;
// To avoid expensive full-file scans, inspect only bounded head/tail windows.
const DEEP_VALIDATION_SCAN_WINDOW_BYTES = 8 * 1024 * 1024;
const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks

function getScanRanges(fileSize: number): Array<[number, number]> {
    if (fileSize <= DEEP_VALIDATION_SCAN_WINDOW_BYTES) {
        return [[0, fileSize]];
    }

    const headEnd = DEEP_VALIDATION_SCAN_WINDOW_BYTES;
    const tailStart = Math.max(0, fileSize - DEEP_VALIDATION_SCAN_WINDOW_BYTES);

    if (tailStart <= headEnd) {
        return [[0, fileSize]];
    }

    return [
        [0, headEnd],
        [tailStart, fileSize],
    ];
}

// Helper function to search for a byte sequence within a file in chunks
async function searchSequenceInFile(file: File, searchBytes: Uint8Array): Promise<boolean> {
    if (file.size > MAX_DEEP_VALIDATION_BYTES) return false;

    const searchLen = searchBytes.length;
    const scanRanges = getScanRanges(file.size);

    for (const [rangeStart, rangeEnd] of scanRanges) {
        for (let offset = rangeStart; offset < rangeEnd; offset += CHUNK_SIZE) {
            // Read chunk with overlap to catch sequences crossing chunk boundaries
            const end = Math.min(offset + CHUNK_SIZE + searchLen - 1, rangeEnd);
            const chunkBuffer = await file.slice(offset, end).arrayBuffer();
            const chunk = new Uint8Array(chunkBuffer);

            let i = chunk.indexOf(searchBytes[0]);
            while (i !== -1 && i <= chunk.length - searchLen) {
                let j = 1;
                while (j < searchLen && chunk[i + j] === searchBytes[j]) {
                    j++;
                }
                if (j === searchLen) {
                    return true;
                }
                i = chunk.indexOf(searchBytes[0], i + 1);
            }
        }
    }

    return false;
}

export async function validateMagicNumbers(file: File, declaredMime: string): Promise<boolean> {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");

    const detectedType = MAGIC_NUMBER_MAP.find(([magic]) => hex.startsWith(magic))?.[1] ?? null;

    if (!detectedType) return false;
    
    const isValidBasic = (MIME_COMPATIBILITY[declaredMime] ?? []).includes(detectedType);
    if (!isValidBasic) return false;

    // Deeper inspection of PPT/PPTX files
    if (declaredMime === MIME_PPTX) {
        const searchString = "ppt/presentation.xml";
        const searchBytes = new TextEncoder().encode(searchString);
        return searchSequenceInFile(file, searchBytes);
    } else if (declaredMime === MIME_PPT) {
        const searchString = "PowerPoint Document";
        // UTF-16LE encoding for OLE2 string
        const searchBytes = new Uint8Array(searchString.length * 2);
        for (let i = 0; i < searchString.length; i++) {
            searchBytes[i * 2] = searchString.charCodeAt(i);
            searchBytes[i * 2 + 1] = 0;
        }
        return searchSequenceInFile(file, searchBytes);
    }

    return true;
}
