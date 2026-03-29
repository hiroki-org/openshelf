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

// Lightweight ZIP parser to check for specific entries
async function checkZipEntry(file: File, searchFilename: string): Promise<boolean> {
    const fileSize = file.size;
    const eocdSearchSize = Math.min(fileSize, 65535 + 22);
    if (eocdSearchSize < 22) return false;

    const eocdSearchBuffer = await file.slice(fileSize - eocdSearchSize, fileSize).arrayBuffer();
    const eocdBytes = new Uint8Array(eocdSearchBuffer);

    let eocdOffset = -1;
    for (let i = eocdBytes.length - 22; i >= 0; i--) {
        if (eocdBytes[i] === 0x50 && eocdBytes[i + 1] === 0x4b && eocdBytes[i + 2] === 0x05 && eocdBytes[i + 3] === 0x06) {
            eocdOffset = i;
            break;
        }
    }

    if (eocdOffset === -1) return false;

    const dataView = new DataView(eocdSearchBuffer);
    const cdOffset = dataView.getUint32(eocdOffset + 16, true);
    const cdSize = dataView.getUint32(eocdOffset + 12, true);

    if (cdOffset + cdSize > fileSize) return false;

    const cdBuffer = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
    const cdDataView = new DataView(cdBuffer);
    const cdBytes = new Uint8Array(cdBuffer);

    let offset = 0;
    const textDecoder = new TextDecoder('utf-8');

    while (offset + 46 <= cdSize) {
        if (cdBytes[offset] !== 0x50 || cdBytes[offset + 1] !== 0x4b || cdBytes[offset + 2] !== 0x01 || cdBytes[offset + 3] !== 0x02) {
            break;
        }

        const fileNameLength = cdDataView.getUint16(offset + 28, true);
        const extraFieldLength = cdDataView.getUint16(offset + 30, true);
        const fileCommentLength = cdDataView.getUint16(offset + 32, true);

        if (offset + 46 + fileNameLength > cdSize) break;

        const fileNameBytes = cdBytes.slice(offset + 46, offset + 46 + fileNameLength);
        const fileName = textDecoder.decode(fileNameBytes);

        if (fileName === searchFilename) {
            return true;
        }

        offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    return false;
}

// Lightweight OLE2 parser to check for specific streams
async function checkOle2Stream(file: File, searchStreamName: string): Promise<boolean> {
    if (file.size < 512) return false;

    const headerBuffer = await file.slice(0, 512).arrayBuffer();
    const headerView = new DataView(headerBuffer);

    const sig1 = headerView.getUint32(0, false);
    const sig2 = headerView.getUint32(4, false);
    if (sig1 !== 0xD0CF11E0 || sig2 !== 0xA1B11AE1) return false;

    const sectorShift = headerView.getUint16(30, true);
    const sectorSize = 1 << sectorShift;

    let dirSector = headerView.getUint32(48, true);
    const numFatSectors = headerView.getUint32(44, true);

    const difat: number[] = [];
    for (let i = 0; i < 109; i++) {
        difat.push(headerView.getUint32(76 + i * 4, true));
    }

    const fat: number[] = [];
    for (let i = 0; i < Math.min(numFatSectors, 109); i++) {
        const fatSectorIdx = difat[i];
        if (fatSectorIdx === 0xFFFFFFFF) break;
        const fatSectorOffset = (fatSectorIdx + 1) * sectorSize;
        if (fatSectorOffset + sectorSize > file.size) return false;

        const fatBuffer = await file.slice(fatSectorOffset, fatSectorOffset + sectorSize).arrayBuffer();
        const fatView = new DataView(fatBuffer);
        for (let j = 0; j < sectorSize / 4; j++) {
            fat.push(fatView.getUint32(j * 4, true));
        }
    }

    const ENDOFCHAIN = 0xFFFFFFFE;
    let maxDirSectors = 1000;

    while (dirSector !== ENDOFCHAIN && maxDirSectors > 0) {
        if (dirSector >= fat.length && fat.length > 0) {
            break;
        }

        const dirOffset = (dirSector + 1) * sectorSize;
        if (dirOffset + sectorSize > file.size) return false;

        const dirBuffer = await file.slice(dirOffset, dirOffset + sectorSize).arrayBuffer();
        const dirView = new DataView(dirBuffer);
        const dirBytes = new Uint8Array(dirBuffer);

        for (let i = 0; i < sectorSize / 128; i++) {
            const entryOffset = i * 128;
            const nameLength = dirView.getUint16(entryOffset + 64, true);
            // Name length is in bytes including null terminator (UTF-16LE)
            if (nameLength > 0 && nameLength <= 64) {
                const nameBytes = dirBytes.slice(entryOffset, entryOffset + nameLength - 2);
                const textDecoder16 = new TextDecoder('utf-16le');
                const name = textDecoder16.decode(nameBytes);

                if (name === searchStreamName) {
                    return true;
                }
            }
        }

        if (fat.length > 0) {
            dirSector = fat[dirSector];
        } else {
            break;
        }
        maxDirSectors--;
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
        return checkZipEntry(file, "ppt/presentation.xml");
    } else if (declaredMime === "application/vnd.ms-powerpoint") {
        return checkOle2Stream(file, "PowerPoint Document");
    }


    return true;
}
