import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import {
    coauthorInvites,
    paperAuthors,
    papers,
    users,
    enableForeignKeys,
} from "../db/schema";
import type { Env, Variables } from "../types";
import { authMiddleware } from "../middleware/auth";

const invitesRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/invites/received — invites sent to the current user
invitesRoute.get("/received", authMiddleware, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("user").sub;

    const rows = await db
        .select({
            id: coauthorInvites.id,
            paperId: coauthorInvites.paperId,
            paperTitle: papers.title,
            inviterId: coauthorInvites.inviterId,
            inviterName: users.name,
            status: coauthorInvites.status,
            createdAt: coauthorInvites.createdAt,
        })
        .from(coauthorInvites)
        .innerJoin(papers, eq(coauthorInvites.paperId, papers.id))
        .innerJoin(users, eq(coauthorInvites.inviterId, users.id))
        .where(
            and(
                eq(coauthorInvites.inviteeId, userId),
                eq(coauthorInvites.status, "pending"),
            ),
        )
        .all();

    return c.json({ invites: rows });
});

/**
 * Handles responding to a co-author invitation.
 * Validates the action, invite existence, and ownership.
 * If accepted, updates status and inserts a co-author record.
 *
 * @param c - The Hono context.
 * @returns A JSON response indicating success or failure.
 */
const respondInviteHandler = async (c: any) => {
    const inviteId = c.req.param("inviteId");
    let body: { action?: unknown };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const action = body.action;

    if (
        !action ||
        typeof action !== "string" ||
        !["accept", "decline"].includes(action)
    ) {
        return c.json({ error: "action must be accept or decline" }, 400);
    }

    const db = drizzle(c.env.DB);
    await enableForeignKeys(db);
    const userId = c.get("user").sub;

    const invite = await db
        .select()
        .from(coauthorInvites)
        .where(eq(coauthorInvites.id, inviteId))
        .get();
    if (!invite) return c.json({ error: "Invite not found" }, 404);
    if (invite.inviteeId !== userId)
        return c.json({ error: "Forbidden" }, 403);
    if (invite.status !== "pending")
        return c.json({ error: "Invite already responded" }, 400);

    const newStatus = action === "accept" ? "accepted" : "declined";

    if (action === "accept") {
        await db.batch([
            db
                .update(coauthorInvites)
                .set({
                    status: newStatus,
                    respondedAt: sql`(datetime('now'))`,
                })
                .where(eq(coauthorInvites.id, inviteId)),
            db.insert(paperAuthors).values({
                paperId: invite.paperId,
                userId,
                role: "coauthor",
            }),
        ]);
    } else {
        await db
            .update(coauthorInvites)
            .set({
                status: newStatus,
                respondedAt: sql`(datetime('now'))`,
            })
            .where(eq(coauthorInvites.id, inviteId));
    }

    return c.json({ ok: true, status: newStatus });
};

// PATCH/PUT /api/invites/:inviteId — accept or decline
invitesRoute.patch("/:inviteId", authMiddleware, respondInviteHandler);
invitesRoute.put("/:inviteId", authMiddleware, respondInviteHandler);

export default invitesRoute;
