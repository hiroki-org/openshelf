import { describe, bench } from "vitest";

describe("R2 Bucket Deletion", () => {
    // Simulate R2 bucket delete behavior
    const createMockBucket = (networkDelayMs: number) => ({
        delete: async (keys: string | string[]) => {
            await new Promise((resolve) => setTimeout(resolve, networkDelayMs));
            // simulate success
            return;
        }
    });

    const bucket = createMockBucket(10); // 10ms network delay
    const files = Array.from({ length: 100 }, (_, i) => ({ r2Key: `file-${i}` }));

    bench("Promise.all single deletes", async () => {
        await Promise.all(files.map((f) => bucket.delete(f.r2Key)));
    });

    bench("Batch delete", async () => {
        const keys = files.map((f) => f.r2Key);
        await bucket.delete(keys);
    });
});
