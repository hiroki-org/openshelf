const MIME_COMPATIBILITY: Record<string, readonly string[]> = {
  "application/pdf": ["application/pdf"],
  "image/png": ["image/png"],
  "image/jpeg": ["image/jpeg"],
  "application/vnd.ms-powerpoint": ["application/x-ole-storage"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "application/zip",
  ],
};

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

interface OleHeader {
  sectorSize: number;
  dirSector: number;
  fatSectors: number[];
}

async function parseOleHeader(file: File): Promise<OleHeader | null> {
  if (file.size < 512) return null;

  const headerBuffer = await file.slice(0, 512).arrayBuffer();
  const headerView = new DataView(headerBuffer);

  // OLE2 magic number check
  if (
    headerView.getUint32(0, true) !== 0xe011cfd0 ||
    headerView.getUint32(4, true) !== 0xe11ab1a1
  ) {
    return null;
  }

  const sectorShift = headerView.getUint16(30, true);
  if (sectorShift !== 9 && sectorShift !== 12) return null; // Usually 9 (512 bytes) or 12 (4096 bytes)

  const sectorSize = 1 << sectorShift;
  const dirSector = headerView.getUint32(48, true); // First directory sector

  // Read MSAT/FAT
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sec = headerView.getUint32(76 + i * 4, true);
    if (sec === 0xffffffff || sec === 0xfffffffe) break; // End of chain or free
    fatSectors.push(sec);
  }

  return { sectorSize, dirSector, fatSectors };
}

function createFatReader(
  file: File,
  sectorSize: number,
  fatSectors: number[],
): (sectorIndex: number) => Promise<number> {
  const loadedFatSectors = new Map<number, DataView>();
  return async (sectorIndex: number): Promise<number> => {
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
}

function checkDirectorySector(
  dirView: DataView,
  targetStream: string,
  sectorSize: number,
): boolean {
  const entriesPerSector = sectorSize / 128; // Directory entries are 128 bytes
  const targetLength = (targetStream.length + 1) * 2; // +1 for null terminator

  for (let i = 0; i < entriesPerSector; i++) {
    const entryOffset = i * 128;
    if (entryOffset + 128 > dirView.byteLength) break;

    const nameLength = dirView.getUint16(entryOffset + 64, true);
    const objectType = dirView.getUint8(entryOffset + 66);

    if (objectType !== 2) continue; // Only process stream object type

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
  return false;
}

// Helper function to parse OLE2 streams to find a specific stream name
async function hasOleStream(
  file: File,
  targetStream: string,
): Promise<boolean> {
  const header = await parseOleHeader(file);
  if (!header) return false;

  const { sectorSize, fatSectors } = header;
  let { dirSector } = header;

  const getFatEntry = createFatReader(file, sectorSize, fatSectors);

  const MAX_DIR_SECTORS = 1000;
  let dirSectorsRead = 0;

  // Group directory reads in batches to reduce sequential I/O overhead
  // A batch of 10 is chosen to strike a balance between memory usage and I/O wait times
  const CHUNK_SECTORS = 10;

  while (
    dirSector !== 0xffffffff &&
    dirSector !== 0xfffffffe &&
    dirSectorsRead < MAX_DIR_SECTORS
  ) {
    const chunk: number[] = [];
    for (let i = 0; i < CHUNK_SECTORS; i++) {
      if (
        dirSector === 0xffffffff ||
        dirSector === 0xfffffffe ||
        dirSectorsRead + i >= MAX_DIR_SECTORS
      ) {
        break;
      }
      const dirOffset = (dirSector + 1) * sectorSize;
      /* v8 ignore next 2 */
      if (dirOffset >= file.size) break;

      chunk.push(dirSector);
      dirSector = await getFatEntry(dirSector);
    }

    /* v8 ignore next 2 */
    if (chunk.length === 0) break;

    // Group the chunk into contiguous blocks
    let currentBlock = { startSector: chunk[0] as number, count: 1 };
    const blocks: { startSector: number; count: number }[] = [];
    for (let i = 1; i < chunk.length; i++) {
      if (chunk[i] === currentBlock.startSector + currentBlock.count) {
        currentBlock.count++;
      } else {
        blocks.push(currentBlock);
        currentBlock = { startSector: chunk[i] as number, count: 1 };
      }
    }
    blocks.push(currentBlock);

    let outOfBounds = false;
    for (const block of blocks) {
      const offset = (block.startSector + 1) * sectorSize;
      if (offset >= file.size) {
        outOfBounds = true;
        break;
      }

      const length = Math.min(block.count * sectorSize, file.size - offset);
      /* v8 ignore next 4 */
      if (length <= 0) {
        outOfBounds = true;
        break;
      }

      const blockBuffer = await file
        .slice(offset, offset + length)
        .arrayBuffer();

      const sectorsInBlock = Math.ceil(blockBuffer.byteLength / sectorSize);
      for (let i = 0; i < sectorsInBlock; i++) {
        const sectorOffset = i * sectorSize;
        const sectorLength = Math.min(
          sectorSize,
          blockBuffer.byteLength - sectorOffset,
        );
        /* v8 ignore next 2 */
        if (sectorLength < 128) continue; // Minimum directory entry size
        const sectorView = new DataView(
          blockBuffer,
          sectorOffset,
          sectorLength,
        );

        if (checkDirectorySector(sectorView, targetStream, sectorSize)) {
          return true;
        }
      }
    }

    /* v8 ignore next 2 */
    if (outOfBounds) break;

    dirSectorsRead += chunk.length;
  }

  return false;
}

export async function validateMagicNumbers(
  file: File,
  declaredMime: string,
): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let detectedType: string | null = null;
    if (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      detectedType = "application/pdf";
    } else if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      detectedType = "image/png";
    } else if (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    ) {
      detectedType = "image/jpeg";
    } else if (
      bytes.length >= 8 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1
    ) {
      detectedType = "application/x-ole-storage";
    } else if (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    ) {
      detectedType = "application/zip";
    }

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
      return await hasZipEntry(file, "ppt/presentation.xml");
    }
    if (declaredMime === "application/vnd.ms-powerpoint") {
      return await hasOleStream(file, "PowerPoint Document");
    }

    return true;
  } catch (error) {
    if (
      error instanceof RangeError ||
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "InvalidStateError")
    ) {
      return false;
    }
    throw error;
  }
}
