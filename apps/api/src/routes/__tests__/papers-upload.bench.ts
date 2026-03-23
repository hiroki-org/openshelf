import { bench, describe } from "vitest";

class MockBucket {
  async put(_key: string, _value: ArrayBuffer | File): Promise<void> {
    return;
  }
}

const bucket = new MockBucket();
const file = new File([new Uint8Array(8 * 1024 * 1024)], "sample.pdf", {
  type: "application/pdf",
});

describe("papers upload path micro benchmark (mock bucket)", () => {
  bench("legacy path: arrayBuffer() + put(buffer)", async () => {
    const buffer = await file.arrayBuffer();
    await bucket.put("legacy/sample.pdf", buffer);
  });

  bench("optimized path: put(file) directly", async () => {
    await bucket.put("optimized/sample.pdf", file);
  });
});
