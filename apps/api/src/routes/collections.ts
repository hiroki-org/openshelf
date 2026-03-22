import { Hono } from "hono";
import { verify } from "hono/jwt";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
    collectionPapers,
    collections,
    enableForeignKeys,
    orgMembers,
    orgs,
    paperAuthors,
    paperOrgs,
    papers,
    touchUpdatedAt,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";
import { validateSlug, validateName, validateDescription } from "../utils/validation";
import { getOrgBySlug, getOrgMembership, isOrgMember, isOrgAdmin } from "../utils/db";

const collectionsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

const VALID_VISIBILITY = ["public", "org_only", "private"] as const;

type Visibility = (typeof VALID_VISIBILITY)[number];
type CurrentUser = { id: string } | null;

function parseVisibility(value: unknown): Visibility | null {
    if (typeof value === "string" && VALID_VISIBILITY.includes(value as Visibility)) {
        return value as Visibility;
    }
    return null;
}

function isUniqueConstraintError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes("UNIQUE") || message.includes("unique") || message.includes("constraint");
}

async function getCurrentUser(c: any): Promise<CurrentUser> {
    const middlewareUser = c.get("user") as { sub?: string } | undefined;
    if (middlewareUser?.sub) return { id: middlewareUser.sub };

    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return null;

    try {
        const payload = (await verify(token, c.env.JWT_SECRET, "HS256")) as { sub?: string };
        if (!payload?.sub) return null;
        return { id: payload.sub };
    } catch {
        return null;
    }
}


export default collectionsRoute;
