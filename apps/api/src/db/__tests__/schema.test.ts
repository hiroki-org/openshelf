import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { touchUpdatedAt } from "../schema.js";

describe("schema helpers", () => {
    describe("touchUpdatedAt", () => {
        it("should return an object with an updatedAt SQL expression for SQLite datetime('now')", () => {
            const expected = { updatedAt: sql`(datetime('now'))` };
            const actual = touchUpdatedAt();

            // Comparing stringified versions to avoid Drizzle's Symbol/internal issues
            // but also checking the query chunks to be sure
            expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));

            // @ts-expect-error accessing internal queryChunks for verification
            const actualChunks = actual.updatedAt.queryChunks;
            // @ts-expect-error accessing internal queryChunks for verification
            const expectedChunks = expected.updatedAt.queryChunks;

            expect(actualChunks).toEqual(expectedChunks);
        });
    });
});
