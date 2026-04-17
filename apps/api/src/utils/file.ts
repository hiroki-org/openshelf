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

// Helper function to search for a byte sequence within a file in chunks
async function searchSequenceInFile(file: File, searchBytes: Uint8Array): Promise<boolean> {
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

export async function validateMagicNumbers(file: File, declaredMime: string): Promise<boolean> {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let detectedType: string | null = null;
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) {
        detectedType = "application/pdf";
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
        detectedType = "image/png";
    } else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        detectedType = "image/jpeg";
    } else if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 && bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1) {
        detectedType = "application/x-ole-storage";
    } else if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
        detectedType = "application/zip";
    }

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
