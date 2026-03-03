export async function validateMagicNumbers(file: File): Promise<boolean> {
    const ALLOWED_MAGIC_TYPES = new Set([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/x-ole-storage",
        "application/zip",
    ]);

    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");

    // マジックナンバーから実際のMIMEタイプを判定
    let detectedType: string | null = null;
    if (hex.startsWith("255044462D")) detectedType = "application/pdf";
    else if (hex.startsWith("89504E470D0A1A0A")) detectedType = "image/png";
    else if (hex.startsWith("FFD8FF")) detectedType = "image/jpeg";
    // TODO: perform deeper inspection when specifically needing PPTX/PPT detection 
    // (for PPTX: open the ZIP and look for "[Content_Types].xml" or PPTX-specific entries like "ppt/presentation.xml"; 
    // for OLE2: parse compound file streams for PowerPoint storages)
    else if (hex.startsWith("D0CF11E0A1B11AE1")) detectedType = "application/x-ole-storage";
    else if (hex.startsWith("504B0304")) detectedType = "application/zip";

    if (!detectedType) return false;
    
    // 検出されたタイプが許可リストに入っているか確認（クライアントの申告MIMEには依存しない）
    return ALLOWED_MAGIC_TYPES.has(detectedType);
}
