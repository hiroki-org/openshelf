import { sign } from "hono/jwt";
import { vi } from "vitest";
import type app from "../index";

const DEFAULT_SECRET = "test-jwt-secret";

export type TestEnv = {
    DB: unknown;
    BUCKET: {
        put: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        get: (key: string) => Promise<{ key: string; value: unknown } | null>;
    };
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    JWT_SECRET: string;
    FRONTEND_URL: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    ENABLE_TEST_AUTH?: string;
    TEST_AUTH_SECRET?: string;
};

export async function createTestApp(): Promise<typeof app> {
    const mod = await import("../index");
    return mod.default;
}

export async function createTestJWT(payload: Record<string, unknown>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return sign(
        {
            ...payload,
            iat: now,
            exp: now + 3600
        },
        DEFAULT_SECRET,
        "HS256"
    );
}

export async function createExpiredJWT(payload: Record<string, unknown>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return sign(
        {
            ...payload,
            iat: now - 7200,
            exp: now - 3600
        },
        DEFAULT_SECRET,
        "HS256"
    );
}

export function makeQuery(
    { getResult = null, allResult = [] }: { getResult?: unknown; allResult?: unknown[] } = {},
) {
    return {
        from() {
            return this;
        },
        where() {
            return this;
        },
        innerJoin() {
            return this;
        },
        leftJoin() {
            return this;
        },
        limit() {
            return this;
        },
        groupBy() {
            return this;
        },
        orderBy() {
            return this;
        },
        get: async () => getResult,
        all: async () => allResult,
    };
}

export type MockDbResponse = {
    getResult?: unknown;
    allResult?: unknown[];
};

export function createMockDb(overrides: Record<string, any> = {}) {
    return {
        run: vi.fn(async () => undefined),
        select: vi.fn(() => makeQuery()),
        insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(async () => ({ meta: { changes: 1 } })) })),
        })),
        delete: vi.fn(() => ({
            where: vi.fn(async () => ({ meta: { changes: 1 } })),
        })),
        batch: vi.fn(async (queries) =>
            Promise.all(queries.map((query: any) => (query.all ? query.all() : query))),
        ),
        ...overrides,
    };
}

export function queueSelectResponses(
    mockDb: { select: unknown },
    responses: MockDbResponse[],
) {
    let index = 0;
    (mockDb as { select: ReturnType<typeof vi.fn> }).select = vi.fn(() => {
        const response = responses[index++];
        if (!response) {
            throw new Error(`queueSelectResponses: unexpected mockDb.select() call #${index}`);
        }
        return makeQuery(response);
    });
}

export function createMockR2() {
    const store = new Map<string, unknown>();
    return {
        put: async (key: string, value: unknown) => {
            store.set(key, value);
        },
        delete: async (key: string) => {
            store.delete(key);
        },
        get: async (key: string) => {
            if (!store.has(key)) return null;
            return { key, value: store.get(key) };
        }
    };
}

export function createTestEnv(overrides: Partial<TestEnv> = {}): TestEnv {
    return {
        DB: {},
        BUCKET: createMockR2(),
        GITHUB_CLIENT_ID: "test-client-id",
        GITHUB_CLIENT_SECRET: "test-client-secret",
        JWT_SECRET: DEFAULT_SECRET,
        FRONTEND_URL: "http://localhost:3000",
        ENVIRONMENT: "development",
        ...overrides
    };
}
