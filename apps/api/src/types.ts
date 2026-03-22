import type { Context } from "hono";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type Env = {
    DB: D1Database;
    BUCKET: R2Bucket;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    JWT_SECRET: string;
    FRONTEND_URL: string;
    ALLOWED_ORIGINS?: string;
    ENABLE_TEST_AUTH?: string;
    TEST_AUTH_SECRET?: string;
    MAX_CACHE_SIZE?: string;
};

export type JwtPayload = {
    sub: string;
    githubId: string;
    name: string;
    exp: number;
};

export type Variables = {
    user: JwtPayload;
};


export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;