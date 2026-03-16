const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
    "application/pdf": ["application/pdf"],
    "image/png": ["image/png"],
    "image/jpeg": ["image/jpeg"],
    "application/vnd.ms-powerpoint": ["application/x-ole-storage"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["application/zip"],
};

const MAGIC_NUMBER_MAP: ReadonlyArray<[string, string]> = [
    ["255044462D", "application/pdf"],
    ["89504E470D0A1A0A", "image/png"],
    ["FFD8FF", "image/jpeg"],
    ["D0CF11E0A1B11AE1", "application/x-ole-storage"],
    ["504B0304", "application/zip"],
];

/**
 * Helper function to search for a byte sequence within a file in chunks.
 * Uses a sliding window approach with chunk overlaps to ensure sequences
 * crossing chunk boundaries are correctly detected.
 *
 * @param file - The File object to search within.
 * @param searchBytes - The Uint8Array byte sequence to look for.
 * @returns A promise that resolves to true if the sequence is found, false otherwise.
 */
export async function searchSequenceInFile(file: File, searchBytes: Uint8Array): Promise<boolean> {
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
    const searchLen = searchBytes.length;
    if (searchLen === 0) return false;

    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        // Read chunk with overlap to catch sequences crossing chunk boundaries
        const end = Math.min(offset + CHUNK_SIZE + searchLen - 1, file.size);
        const chunkBuffer = await file.slice(offset, end).arrayBuffer();
        const chunk = new Uint8Array(chunkBuffer);

        let i = chunk.indexOf(searchBytes[0]);
        while (i !== -1 && i <= chunk.length - searchLen) {
            let match = true;
            for (let j = 1; j < searchLen; j++) {
                if (chunk[i + j] !== searchBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return true;
            }
            i = chunk.indexOf(searchBytes[0], i + 1);
        }
    }

    return false;
}

/**
 * Validates a file's content against its declared MIME type using magic numbers.
 * Performs deep inspection for specific formats like PPT and PPTX.
 *
 * @param file - The File object to validate.
 * @param declaredMime - The MIME type string declared by the client.
 * @returns A promise that resolves to true if the file content matches the declared type.
 */
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
    if (declaredMime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        const searchString = "ppt/presentation.xml";
        const searchBytes = new TextEncoder().encode(searchString);
        return searchSequenceInFile(file, searchBytes);
    } else if (declaredMime === "application/vnd.ms-powerpoint") {
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
