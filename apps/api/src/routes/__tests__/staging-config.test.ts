import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createMockD1Binding,
    createTestApp,
    createTestEnv,
    makeQuery,
} from "../../test/helpers";

const WRANGLER_TOML = readFileSync(
    new URL("../../../wrangler.toml", import.meta.url),
    "utf8",
);
const STAGING_VARS_SECTION =
    WRANGLER_TOML.match(/\[env\.staging\.vars\]([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";

function readStagingVar(name: "FRONTEND_URL" | "ALLOWED_ORIGINS") {
    const match = STAGING_VARS_SECTION.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"$`, "m"));
    if (!match) {
        throw new Error(`Missing ${name} in apps/api/wrangler.toml [env.staging.vars]`);
    }
    return match[1];
}

const STAGING_URL = readStagingVar("FRONTEND_URL");
const STAGING_ALLOWED_ORIGINS = readStagingVar("ALLOWED_ORIGINS");
const HTTP_STAGING_URL = STAGING_URL.replace(/^https:/, "http:");

let mockDb: any;

vi.mock("drizzle-orm/d1", () => ({
    drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
    users: { id: "id", githubId: "github_id" },
    orgs: { id: "id" },
    orgMembers: { orgId: "org_id" },
    papers: {
        id: "id",
        title: "title",
        abstract: "abstract",
        category: "category",
        tags: "tags",
        createdAt: "created_at",
        updatedAt: "updated_at",
        visibility: "visibility",
    },
    paperAuthors: {
        paperId: "paper_id",
        role: "role",
        name: "name",
        displayName: "display_name",
        userId: "user_id",
    },
    paperFiles: {
        paperId: "paper_id",
        id: "id",
        filename: "filename",
        sizeBytes: "size_bytes",
        mimeType: "mime_type",
        fileType: "file_type",
        createdAt: "created_at",
    },
    paperOrgs: { paperId: "paper_id", orgId: "org_id" },
    collections: {
        id: "id",
        ownerType: "owner_type",
        ownerId: "owner_id",
        orgSlug: "org_slug",
        slug: "slug",
        name: "name",
        visibility: "visibility",
        updatedAt: "updated_at",
    },
    collectionPapers: {
        collectionId: "collection_id",
        paperId: "paper_id",
        sortOrder: "sort_order",
    },
    enableForeignKeys: vi.fn(() => Promise.resolve()),
    touchUpdatedAt: vi.fn(() => ({})),
}));

beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockDb = {
        run: vi.fn(async () => undefined),
        select: vi.fn(() => makeQuery()),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                onConflictDoUpdate: vi.fn(async () => undefined),
            })),
        })),
    };
});

// ---------------------------------------------------------------------------
// CORS – staging ALLOWED_ORIGINS configuration
// ---------------------------------------------------------------------------

describe("CORS – staging Vercel URL in ALLOWED_ORIGINS", () => {
    it("accepts the staging Vercel URL as a valid CORS origin", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            { headers: { Origin: STAGING_URL } },
            env as any,
        );

        expect(res.headers.get("access-control-allow-origin")).toBe(STAGING_URL);
    });

    it("blocks localhost:3000 when ALLOWED_ORIGINS contains only the staging URL (regression: old value removed)", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            { headers: { Origin: "http://localhost:3000" } },
            env as any,
        );

        // localhost:3000 is no longer in ALLOWED_ORIGINS – it must be blocked.
        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("blocks the HTTP (non-HTTPS) variant of the staging URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            { headers: { Origin: HTTP_STAGING_URL } },
            env as any,
        );

        // The allowed list contains only the HTTPS URL; the HTTP variant is different.
        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("blocks an unrelated origin when ALLOWED_ORIGINS is set to the staging URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            { headers: { Origin: "https://attacker.example.com" } },
            env as any,
        );

        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("uses the staging URL as CORS origin fallback when ALLOWED_ORIGINS is absent", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: undefined,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            { headers: { Origin: STAGING_URL } },
            env as any,
        );

        expect(res.headers.get("access-control-allow-origin")).toBe(STAGING_URL);
    });
});

// ---------------------------------------------------------------------------
// CORS – OPTIONS preflight with staging configuration
// ---------------------------------------------------------------------------

describe("CORS preflight – staging Vercel URL in ALLOWED_ORIGINS", () => {
    it("returns correct preflight headers for the staging Vercel URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: STAGING_URL,
                    "Access-Control-Request-Method": "POST",
                },
            },
            env as any,
        );

        expect(res.headers.get("access-control-allow-origin")).toBe(STAGING_URL);
        expect(res.headers.get("access-control-allow-methods")).toContain("POST");
        expect(res.headers.get("access-control-allow-headers")).toBeTruthy();
    });

    it("blocks preflight for localhost:3000 now that staging URL is the sole ALLOWED_ORIGINS", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                },
            },
            env as any,
        );

        // localhost:3000 is no longer allowed – preflight must be blocked.
        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("blocks preflight for the HTTP variant of the staging URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            DB: createMockD1Binding(),
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_ALLOWED_ORIGINS,
        });

        const res = await app.request(
            "http://localhost/api/auth/github",
            {
                method: "OPTIONS",
                headers: {
                    Origin: HTTP_STAGING_URL,
                    "Access-Control-Request-Method": "DELETE",
                },
            },
            env as any,
        );

        expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// CSRF – staging Vercel URL as FRONTEND_URL / ALLOWED_ORIGINS
// ---------------------------------------------------------------------------

describe("CSRF – staging Vercel URL configuration", () => {
    it("allows a mutative request whose Origin matches the staging FRONTEND_URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_URL,
            ENABLE_TEST_AUTH: "false",
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: { Origin: STAGING_URL },
            },
            env as any,
        );

        // CSRF check passes; result depends on auth, but must NOT be 403 Forbidden.
        expect(res.status).not.toBe(403);
    });

    it("blocks a mutative request whose Origin is localhost:3000 when staging URL is FRONTEND_URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_URL,
            ENABLE_TEST_AUTH: "false",
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: { Origin: "http://localhost:3000" },
            },
            env as any,
        );

        expect(res.status).toBe(403);
    });

    it("blocks a mutative request whose Origin is the HTTP variant of the staging URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_URL,
            ENABLE_TEST_AUTH: "false",
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: { Origin: HTTP_STAGING_URL },
            },
            env as any,
        );

        expect(res.status).toBe(403);
    });

    it("allows a mutative request whose Referer is under the staging URL", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_URL,
            ENABLE_TEST_AUTH: "false",
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            {
                method: "POST",
                headers: {
                    // No Origin header – CSRF relies on Referer only.
                    Referer: `${STAGING_URL}/some/page`,
                },
            },
            env as any,
        );

        expect(res.status).not.toBe(403);
    });

    it("blocks a mutative request with no Origin and no Referer", async () => {
        const app = await createTestApp();
        const env = createTestEnv({
            FRONTEND_URL: STAGING_URL,
            ALLOWED_ORIGINS: STAGING_URL,
            ENABLE_TEST_AUTH: "false",
        });

        const res = await app.request(
            "http://localhost/api/auth/logout",
            { method: "POST" },
            env as any,
        );

        expect(res.status).toBe(403);
    });
});
