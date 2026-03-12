import { sign } from "hono/jwt";
import type { D1Database } from "@cloudflare/workers-types";
import type app from "../index";
import { vi } from "vitest";

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
    ALLOWED_ORIGINS?: string;
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
        limit() {
            return this;
        },
        get: async () => getResult,
        all: async () => allResult,
    };
}

type MockD1StatementHandler = {
    run?: () => Promise<unknown>;
    first?: () => Promise<unknown>;
    all?: () => Promise<{ results: unknown[] }>;
};

type MockD1QueryHandler = (query: string) => MockD1StatementHandler | undefined;

const createPreparedStatement = (handler?: MockD1StatementHandler) => {
    const run = vi.fn(async () => {
        if (handler?.run) return handler.run();
        return { results: [] };
    });
    const first = vi.fn(async () => {
        if (handler?.first) return handler.first();
        return null;
    });
    const all = vi.fn(async () => {
        if (handler?.all) return handler.all();
        return { results: [] };
    });

    return {
        bind: vi.fn(() => ({ run, first, all })),
        run,
        first,
        all,
    };
};

export function createMockD1(
    {
        sessionHandler,
        dbHandler,
    }: {
        sessionHandler?: MockD1QueryHandler;
        dbHandler?: MockD1QueryHandler;
    } = {},
) {
    const sessionPrepare = vi.fn((query: string) =>
        createPreparedStatement(sessionHandler?.(query)),
    );
    const dbPrepare = vi.fn((query: string) =>
        createPreparedStatement(dbHandler?.(query)),
    );
    const session = {
        prepare: sessionPrepare,
        batch: vi.fn(async () => []),
    };
    const withSession = vi.fn(() => session);
    const db = {
        prepare: dbPrepare,
        batch: vi.fn(async () => []),
        exec: vi.fn(async () => ({ count: 0, duration: 0 })),
        withSession,
        dump: vi.fn(async () => new ArrayBuffer(0)),
    } as unknown as D1Database;

    return {
        db,
        sessionPrepare,
        dbPrepare,
        withSession,
    };
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
        ...overrides
    };
}
