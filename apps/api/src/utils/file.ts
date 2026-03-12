export const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
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

// Returns the detected MIME type, or null if file header is unrecognized
export async function detectMimeType(file: File): Promise<string | null> {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");

    return MAGIC_NUMBER_MAP.find(([magic]) => hex.startsWith(magic))?.[1] ?? null;
}

// Validates that detected MIME is one of the allowed types
export async function validateMagicNumbers(file: File, allowedMimeTypes: string[]): Promise<boolean> {
    const detectedType = await detectMimeType(file);
    
    if (!detectedType) return false;
    
    return allowedMimeTypes.some(allowed => (MIME_COMPATIBILITY[allowed] ?? []).includes(detectedType));
}
