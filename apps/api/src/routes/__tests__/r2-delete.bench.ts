import { describe, bench } from "vitest";

describe("R2 Bucket Deletion", () => {
    // Simulate R2 API behavior with limited parallel single-request throughput
    const createMockBucket = (
        networkDelayMs: number,
        maxConcurrentSingleDeletes: number,
    ) => {
        let inFlightSingles = 0;
        const waiters: Array<() => void> = [];

        const acquireSingleSlot = async () => {
            if (inFlightSingles < maxConcurrentSingleDeletes) {
                inFlightSingles += 1;
                return;
            }

            await new Promise<void>((resolve) => waiters.push(resolve));
            inFlightSingles += 1;
        };

        const releaseSingleSlot = () => {
            inFlightSingles -= 1;
            const next = waiters.shift();
            if (next) next();
        };

        return {
            delete: async (keys: string | string[]) => {
                if (Array.isArray(keys)) {
                    await new Promise((resolve) => setTimeout(resolve, networkDelayMs));
                    return;
                }

                await acquireSingleSlot();
                try {
                    await new Promise((resolve) => setTimeout(resolve, networkDelayMs));
                } finally {
                    releaseSingleSlot();
                }
            },
        };
    };

    const bucket = createMockBucket(10, 10); // 10ms delay, max 10 concurrent single deletes
    const files = Array.from({ length: 1000 }, (_, i) => ({ r2Key: `file-${i}` }));

    bench("Promise.all single deletes", async () => {
        await Promise.all(files.map((f) => bucket.delete(f.r2Key)));
    });

    bench("Batch delete", async () => {
        const keys = files.map((f) => f.r2Key);
        await bucket.delete(keys);
    });
});
