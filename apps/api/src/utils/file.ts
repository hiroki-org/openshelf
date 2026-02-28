export async function validateMagicNumbers(file: File): Promise<boolean> {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");

    if (file.type === "application/pdf" && hex.startsWith("255044462D")) return true;
    if (file.type === "image/png" && hex.startsWith("89504E470D0A1A0A")) return true;
    if (file.type === "image/jpeg" && hex.startsWith("FFD8FF")) return true;
    if (file.type === "application/vnd.ms-powerpoint" && hex.startsWith("D0CF11E0A1B11AE1")) return true;
    if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" && hex.startsWith("504B0304")) return true;

    return false;
}
