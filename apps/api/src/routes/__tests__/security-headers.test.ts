import { describe, expect, it } from "vitest";
import { createTestApp, createTestEnv } from "../../test/helpers";

describe("security headers", () => {
    it("sets frame blocking headers consistently", async () => {
        const app = await createTestApp();
        const env = createTestEnv();

        const res = await app.request("http://localhost/", {}, env as any);

        expect(res.headers.get("x-frame-options")).toBe("DENY");
        expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    });
});
