import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
    orgs,
    orgMembers,
    paperOrgs,
    papers,
    paperAuthors,
    users,
    enableForeignKeys,
    touchUpdatedAt,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { getOrgBySlug, getOrgMembership, requireOrgAdmin, isOrgMember, isPaperAuthor } from "../utils/db";
import { validateSlug, validateName, validateDescription } from "../utils/validation";

const orgsRoute = new Hono<{ Bindings: Env; Variables: Variables }>();


// ─── Permission helpers ─────────────────────────────────────────

export default orgsRoute;
