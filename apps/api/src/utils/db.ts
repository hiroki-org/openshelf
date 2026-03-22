import { eq, and } from "drizzle-orm";
import { type drizzle } from "drizzle-orm/d1";
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

export async function isOrgMember(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    return !!(await getOrgMembership(db, orgId, userId));
}

export async function isOrgAdmin(db: ReturnType<typeof drizzle>, orgId: string, userId: string) {
    const row = await getOrgMembership(db, orgId, userId);
    return !!row && (row.role === "admin" || row.role === "owner");
}

export async function isPaperAuthor(db: ReturnType<typeof drizzle>, paperId: string, userId: string) {
    const author = await db
        .select({ id: paperAuthors.paperId })
        .from(paperAuthors)
        .where(and(eq(paperAuthors.paperId, paperId), eq(paperAuthors.userId, userId)))
        .get();
    return !!author;
}

export async function isPaperUploader(db: ReturnType<typeof drizzle>, paperId: string, userId: string) {
    const uploader = await db
        .select({ id: paperAuthors.paperId })
        .from(paperAuthors)
        .where(
            and(
                eq(paperAuthors.paperId, paperId),
                eq(paperAuthors.userId, userId),
                eq(paperAuthors.role, "uploader"),
            )
        )
        .get();
    return !!uploader;
}

export async function isMemberOfPaperOrg(db: ReturnType<typeof drizzle>, paperId: string, userId: string) {
    const isMember = await db
        .select({ id: orgMembers.userId })
        .from(orgMembers)
        .innerJoin(paperOrgs, eq(orgMembers.orgId, paperOrgs.orgId))
        .where(
            and(
                eq(paperOrgs.paperId, paperId),
                eq(orgMembers.userId, userId),
            )
        )
        .get();
    return !!isMember;
}
