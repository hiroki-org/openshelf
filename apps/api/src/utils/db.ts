import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { orgs, orgMembers, paperAuthors, paperOrgs } from "../db/schema";

export async function getOrgBySlug(db: ReturnType<typeof drizzle>, slug: string) {
    return db.select().from(orgs).where(eq(orgs.slug, slug)).get();
}

export async function getOrgMembership(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    return db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .get();
}

export async function requireOrgAdmin(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    const membership = await getOrgMembership(db, orgId, userId);
    if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return { ok: false as const, error: "Forbidden: admin access required" };
    }
    return { ok: true as const, membership };
}

export async function isOrgMember(db: ReturnType<typeof drizzle>, orgId: string, userId: string): Promise<boolean> {
    const membership = await getOrgMembership(db, orgId, userId);
    return !!membership;
}

export async function isOrgAdmin(db: ReturnType<typeof drizzle>, orgId: string, userId: string): Promise<boolean> {
    const membership = await getOrgMembership(db, orgId, userId);
    return !!membership && (membership.role === "admin" || membership.role === "owner");
}

export async function isPaperAuthor(db: ReturnType<typeof drizzle>, paperId: string, userId: string): Promise<boolean> {
    const author = await db
        .select()
        .from(paperAuthors)
        .where(and(eq(paperAuthors.paperId, paperId), eq(paperAuthors.userId, userId)))
        .get();
    return !!author;
}
