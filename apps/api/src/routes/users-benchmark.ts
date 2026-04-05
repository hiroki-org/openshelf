const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_SIZE = 1000;

type CachedSearchResult = {
    data: any[];
    timestamp: number;
};

// --- BASELINE ---
const searchCacheBaseline = new Map<string, CachedSearchResult>();

function setCachedResultsBaseline(key: string, data: any[], overrideNow?: number) {
    if (searchCacheBaseline.size >= MAX_CACHE_SIZE) {
        const now = overrideNow || Date.now();
        for (const [k, v] of searchCacheBaseline.entries()) {
            if (now - v.timestamp > CACHE_TTL_MS) {
                searchCacheBaseline.delete(k);
            }
        }
        if (searchCacheBaseline.size >= MAX_CACHE_SIZE) {
            searchCacheBaseline.clear();
        }
    }
    searchCacheBaseline.set(key, { data, timestamp: overrideNow || Date.now() });
}

// --- OPTIMIZED ---
const searchCacheOptimized = new Map<string, CachedSearchResult>();

function setCachedResultsOptimized(key: string, data: any[], overrideNow?: number) {
    if (searchCacheOptimized.size >= MAX_CACHE_SIZE) {
        const now = overrideNow || Date.now();
        for (const [k, v] of searchCacheOptimized.entries()) {
            if (now - v.timestamp > CACHE_TTL_MS) {
                searchCacheOptimized.delete(k);
            } else {
                break; // Stop early because insertion order guarantees subsequent items are newer
            }
        }

        // Use clear() just like baseline to prevent full map iteration vs single O(1) eviction
        if (searchCacheOptimized.size >= MAX_CACHE_SIZE) {
            searchCacheOptimized.clear();
        }
    }
    searchCacheOptimized.set(key, { data, timestamp: overrideNow || Date.now() });
}

// --- BENCHMARK ---
function runBenchmark() {
    console.log("Running benchmark...");

    // The previous benchmark showed that `searchCacheOptimized.clear()` makes it much faster
    // because clearing is incredibly fast compared to deleting one element on every insertion!
    // If we only delete one element, the next insertion size is 1000 again,
    // so it iterates again (O(1) iterator setup overhead, but still done 500,000 times!).
    // If we clear(), size drops to 0, and the next 1000 insertions have NO overhead!
    // So `clear()` is an amortized O(1) approach that is practically much faster.

    // BUT baseline iteration still goes through the whole map.
    // If only a few items are expired, baseline iterates all 1000 items.
    // Optimized breaks early.
    // Let's create a realistic workload: TTL is 60s. Max size is 1000.
    // Items expire gradually.

    const simulateTraffic = (setter: Function) => {
        let time = 0;
        const start = performance.now();

        // 500,000 requests. Insert 1 item every 50ms.
        // After 1200 items (60,000ms), items start expiring.
        // Wait, at 50ms/item, 1000 items = 50,000ms. No items are expired when size=1000.
        // It clears. So next 1000 items are added.
        // Let's insert 1 item every 65ms.
        // At 1000 items, time = 65,000ms.
        // 65,000 - timestamp for first item = 65,000. It expires.
        // Number of expired items: (65,000 - 60,000) / 65 = 76 items.
        // So baseline iterates 1000 items, deletes 76. Size drops to 924.
        // Then no clear happens!
        // Next 76 insertions, size grows back to 1000. Time advances by 76 * 65 = 4940ms.
        // New time = 69,940ms.
        // Oldest item is now at index 76 (which was inserted at 76 * 65 = 4940).
        // 69,940 - 4940 = 65,000ms. Expired!
        // Baseline iterates 1000, deletes 76.
        // This repeats!

        for (let i = 0; i < 500000; i++) {
            time += 65;
            setter(`key-${i}`, [], time);
        }
        return performance.now() - start;
    }

    const tBase = simulateTraffic(setCachedResultsBaseline);
    const tOpt = simulateTraffic(setCachedResultsOptimized);

    console.log(`Baseline time: ${tBase.toFixed(2)} ms`);
    console.log(`Optimized time: ${tOpt.toFixed(2)} ms`);
    console.log(`Improvement: ${((tBase - tOpt) / tBase * 100).toFixed(2)}%`);
}

runBenchmark();
