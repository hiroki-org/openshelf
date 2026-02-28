export async function validateMagicNumbers(file: File): Promise<boolean> {
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
    else if (hex.startsWith("D0CF11E0A1B11AE1")) detectedType = "application/vnd.ms-powerpoint";
    else if (hex.startsWith("504B0304")) detectedType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    if (!detectedType) return false;
    
    // 検出されたタイプが申告されたタイプと一致することを確認
    return detectedType === file.type;
}
