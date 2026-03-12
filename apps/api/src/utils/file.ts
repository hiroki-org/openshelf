const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
    "application/pdf": ["application/pdf"],
    "image/png": ["image/png"],
    "image/jpeg": ["image/jpeg"],
    // TODO: For deeper inspection of PPT/PPTX, parse OLE2 streams or check for specific ZIP entries like "ppt/presentation.xml"
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



// Maximum file size to perform deep content validation (50 MB).
// Files larger than this are likely not standard presentation files and
// scanning them entirely would be a DoS vector.
const MAX_DEEP_VALIDATION_BYTES = 50 * 1024 * 1024;

// Helper function to search for a byte sequence within a file in chunks
async function searchSequenceInFile(file: File, searchBytes: Uint8Array): Promise<boolean> {
    if (file.size > MAX_DEEP_VALIDATION_BYTES) return false;

    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks
    const searchLen = searchBytes.length;

    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        // Read chunk with overlap to catch sequences crossing chunk boundaries
        const end = Math.min(offset + CHUNK_SIZE + searchLen - 1, file.size);
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
