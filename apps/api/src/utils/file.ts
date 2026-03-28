const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
  "application/pdf": ["application/pdf"],
  "image/png": ["image/png"],
  "image/jpeg": ["image/jpeg"],
  "application/vnd.ms-powerpoint": ["application/x-ole-storage"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "application/zip",
  ],
};

const MAGIC_NUMBER_MAP: ReadonlyArray<[string, string]> = [
  ["255044462D", "application/pdf"],
  ["89504E470D0A1A0A", "image/png"],
  ["FFD8FF", "image/jpeg"],
  ["D0CF11E0A1B11AE1", "application/x-ole-storage"],
  ["504B0304", "application/zip"],
];

// Helper function to efficiently parse ZIP Central Directory to find a specific entry
async function hasZipEntry(file: File, targetEntry: string): Promise<boolean> {
  const CHUNK_SIZE = 65536 + 22; // Max comment size + EOCD size
  const start = Math.max(0, file.size - CHUNK_SIZE);
  const endChunk = await file.slice(start).arrayBuffer();
  const dataView = new DataView(endChunk);

  let eocdOffset = -1;
  // Search backwards for End of Central Directory signature (0x06054b50)
  for (let i = endChunk.byteLength - 22; i >= 0; i--) {
    if (dataView.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return false;

  const cdOffset = dataView.getUint32(eocdOffset + 16, true);
  const cdSize = dataView.getUint32(eocdOffset + 12, true);
  const cdEntries = dataView.getUint16(eocdOffset + 10, true);

  if (cdOffset >= file.size || cdOffset + cdSize > file.size) return false;

  const cdBuffer = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cdView = new DataView(cdBuffer);

  let offset = 0;
  const textDecoder = new TextDecoder("utf-8");

  for (let i = 0; i < cdEntries && offset + 46 <= cdBuffer.byteLength; i++) {
    // Central Directory File Header signature (0x02014b50)
    if (cdView.getUint32(offset, true) !== 0x02014b50) break;

    const nameLen = cdView.getUint16(offset + 28, true);
    const extraLen = cdView.getUint16(offset + 30, true);
    const commentLen = cdView.getUint16(offset + 32, true);

    if (offset + 46 + nameLen > cdBuffer.byteLength) break;

    const nameBytes = new Uint8Array(cdBuffer, offset + 46, nameLen);
    const name = textDecoder.decode(nameBytes);

    if (name === targetEntry) return true;

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return false;
}

// Helper function to parse OLE2 streams to find a specific stream name
async function hasOleStream(
  file: File,
  targetStream: string,
): Promise<boolean> {
  if (file.size < 512) return false;

  const headerBuffer = await file.slice(0, 512).arrayBuffer();
  const headerView = new DataView(headerBuffer);

  // OLE2 magic number check
  if (
    headerView.getUint32(0, false) !== 0xd0cf11e0 ||
    headerView.getUint32(4, false) !== 0xa1b11ae1
  ) {
    return false;
  }

  const sectorShift = headerView.getUint16(30, true);
  if (sectorShift !== 9 && sectorShift !== 12) return false; // Usually 9 (512 bytes) or 12 (4096 bytes)

  const sectorSize = 1 << sectorShift;
  let dirSector = headerView.getUint32(48, true); // First directory sector

  // Read MSAT/FAT
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sec = headerView.getUint32(116 + i * 4, true);
    if (sec === 0xffffffff || sec === 0xfffffffe) break; // End of chain or free
    fatSectors.push(sec);
  }

  const loadedFatSectors = new Map<number, DataView>();
  const getFatEntry = async (sectorIndex: number): Promise<number> => {
    const entriesPerFatSector = sectorSize / 4;
    const fatSectorIndex = Math.floor(sectorIndex / entriesPerFatSector);
    if (fatSectorIndex >= fatSectors.length) return 0xffffffff;

    if (!loadedFatSectors.has(fatSectorIndex)) {
      const fatSectorNum = fatSectors[fatSectorIndex];
      if (fatSectorNum === undefined) return 0xffffffff;
      const offset = (fatSectorNum + 1) * sectorSize;
      if (offset >= file.size) return 0xffffffff;
      const buffer = await file
        .slice(offset, offset + sectorSize)
        .arrayBuffer();
      loadedFatSectors.set(fatSectorIndex, new DataView(buffer));
    }

    const fatView = loadedFatSectors.get(fatSectorIndex)!;
    const entryIndex = sectorIndex % entriesPerFatSector;
    if (entryIndex * 4 >= fatView.byteLength) return 0xffffffff;
    return fatView.getUint32(entryIndex * 4, true);
  };

  const MAX_DIR_SECTORS = 1000;
  let dirSectorsRead = 0;

  const targetLength = (targetStream.length + 1) * 2; // +1 for null terminator

  while (
    dirSector !== 0xffffffff &&
    dirSector !== 0xfffffffe &&
    dirSectorsRead < MAX_DIR_SECTORS
  ) {
    const dirOffset = (dirSector + 1) * sectorSize;
    if (dirOffset >= file.size) break;

    const dirBuffer = await file
      .slice(dirOffset, dirOffset + sectorSize)
      .arrayBuffer();
    const dirView = new DataView(dirBuffer);

    const entriesPerSector = sectorSize / 128; // Directory entries are 128 bytes
    for (let i = 0; i < entriesPerSector; i++) {
      const entryOffset = i * 128;
      if (entryOffset + 128 > dirView.byteLength) break;

      const nameLength = dirView.getUint16(entryOffset + 64, true);
      const objectType = dirView.getUint8(entryOffset + 66);

      if (objectType === 0) continue; // Empty entry

      if (nameLength === targetLength) {
        let match = true;
        for (let j = 0; j < targetStream.length; j++) {
          if (
            dirView.getUint16(entryOffset + j * 2, true) !==
            targetStream.charCodeAt(j)
          ) {
            match = false;
            break;
          }
        }
        // Check null terminator
        if (
          match &&
          dirView.getUint16(entryOffset + targetStream.length * 2, true) === 0
        ) {
          return true;
        }
      }
    }

    dirSector = await getFatEntry(dirSector);
    dirSectorsRead++;
  }

  return false;
}

export async function validateMagicNumbers(
  file: File,
  declaredMime: string,
): Promise<boolean> {
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");

  const detectedType =
    MAGIC_NUMBER_MAP.find(([magic]) => hex.startsWith(magic))?.[1] ?? null;

  if (!detectedType) return false;

  const isValidBasic = (MIME_COMPATIBILITY[declaredMime] ?? []).includes(
    detectedType,
  );
  if (!isValidBasic) return false;

  // Deeper inspection of PPT/PPTX files
  if (
    declaredMime ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return hasZipEntry(file, "ppt/presentation.xml");
  } else if (declaredMime === "application/vnd.ms-powerpoint") {
    return hasOleStream(file, "PowerPoint Document");
  }

  return true;
}
