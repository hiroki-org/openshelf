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

// Helper function to check for a specific entry in a ZIP file (Central Directory parsing)
async function hasZipEntry(file: File, entryName: string): Promise<boolean> {
  const CHUNK_SIZE = 64 * 1024; // EOCD is usually within the last 64KB
  const fileSize = file.size;
  const searchEnd = Math.max(0, fileSize - CHUNK_SIZE);

  // Read the end of the file to find End of Central Directory (EOCD) signature
  const buffer = await file.slice(searchEnd, fileSize).arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // EOCD signature is 0x06054b50 (50 4B 05 06)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return false;

  // Read Central Directory offset and size
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (cdOffset >= fileSize) return false;

  // Read Central Directory
  const cdBuffer = await file
    .slice(cdOffset, Math.min(cdOffset + cdSize, fileSize))
    .arrayBuffer();
  const cdView = new DataView(cdBuffer);
  const cdBytes = new Uint8Array(cdBuffer);
  const decoder = new TextDecoder("utf-8");

  let offset = 0;
  while (offset <= cdBytes.length - 46) {
    // CD File Header signature is 0x02014b50 (50 4B 01 02)
    if (cdView.getUint32(offset, true) !== 0x02014b50) break;

    const nameLen = cdView.getUint16(offset + 28, true);
    const extraLen = cdView.getUint16(offset + 30, true);
    const commentLen = cdView.getUint16(offset + 32, true);

    if (offset + 46 + nameLen > cdBytes.length) break;

    const nameBytes = cdBytes.subarray(offset + 46, offset + 46 + nameLen);
    const name = decoder.decode(nameBytes);

    if (name === entryName) return true;

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return false;
}

// Helper function to check for a specific stream within an OLE2 storage file
async function hasOleStream(file: File, streamName: string): Promise<boolean> {
  if (file.size < 512) return false;

  // Read OLE2 header
  const headerBuffer = await file.slice(0, 512).arrayBuffer();
  const headerView = new DataView(headerBuffer);

  // Check magic number (D0 CF 11 E0 A1 B1 1A E1)
  if (
    headerView.getUint32(0, false) !== 0xd0cf11e0 ||
    headerView.getUint32(4, false) !== 0xa1b11ae1
  ) {
    return false;
  }

  const sectorShift = headerView.getUint16(30, true);
  const sectorSize = 1 << sectorShift; // usually 512
  const firstDirSector = headerView.getUint32(48, true);

  // Simple traversal: assume directory is contiguous or search within first few directory sectors
  // To avoid complex FAT parsing, we just read the first few directory sectors.
  // Each directory sector has (sectorSize / 128) entries.
  const dirOffset = (firstDirSector + 1) * sectorSize;
  if (dirOffset >= file.size) return false;

  // Read up to 4 directory sectors (usually enough for simple PPT files)
  const MAX_DIR_SECTORS = 4;
  const dirBuffer = await file
    .slice(
      dirOffset,
      Math.min(dirOffset + sectorSize * MAX_DIR_SECTORS, file.size),
    )
    .arrayBuffer();
  const dirView = new DataView(dirBuffer);

  // Each directory entry is 128 bytes
  const numEntries = Math.floor(dirBuffer.byteLength / 128);
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = i * 128;
    const nameLen = dirView.getUint16(entryOffset + 64, true);

    // Name length includes null terminator, so nameLen must be streamName.length * 2 + 2
    const expectedLen = streamName.length * 2 + 2;
    if (nameLen === expectedLen) {
      let match = true;
      for (let j = 0; j < streamName.length; j++) {
        if (
          dirView.getUint16(entryOffset + j * 2, true) !==
          streamName.charCodeAt(j)
        ) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
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
