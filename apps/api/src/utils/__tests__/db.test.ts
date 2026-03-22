import { describe, expect, it, vi } from "vitest";
import { makeQuery } from "../../test/helpers";
import {
    getOrgBySlug,
    getOrgMembership,
    isMemberOfPaperOrg,
    isOrgAdmin,
    isOrgMember,
    isPaperAuthor,
    isPaperUploader,
} from "../db";

function createMockDb(getResult: unknown) {
    return {
        select: vi.fn(() => makeQuery({ getResult })),
    };
}

describe("db utils", () => {
    it("gets an org by slug", async () => {
        const org = { id: "org-1", slug: "open-shelf" };
        const db = createMockDb(org);

        await expect(getOrgBySlug(db as never, org.slug)).resolves.toEqual(org);
        expect(db.select).toHaveBeenCalledWith();
    });

    it("gets an org membership", async () => {
        const membership = { orgId: "org-1", userId: "user-1", role: "member" };
        const db = createMockDb(membership);

        await expect(getOrgMembership(db as never, "org-1", "user-1")).resolves.toEqual(membership);
        expect(db.select).toHaveBeenCalledWith();
    });

    it("detects org membership presence", async () => {
        const memberDb = createMockDb({ orgId: "org-1", userId: "user-1", role: "member" });
        const nonMemberDb = createMockDb(null);

        await expect(isOrgMember(memberDb as never, "org-1", "user-1")).resolves.toBe(true);
        await expect(isOrgMember(nonMemberDb as never, "org-1", "user-2")).resolves.toBe(false);
    });

    it("detects org admin roles", async () => {
        const ownerDb = createMockDb({ orgId: "org-1", userId: "user-1", role: "owner" });
        const adminDb = createMockDb({ orgId: "org-1", userId: "user-2", role: "admin" });
        const memberDb = createMockDb({ orgId: "org-1", userId: "user-3", role: "member" });
        const missingDb = createMockDb(null);

        await expect(isOrgAdmin(ownerDb as never, "org-1", "user-1")).resolves.toBe(true);
        await expect(isOrgAdmin(adminDb as never, "org-1", "user-2")).resolves.toBe(true);
        await expect(isOrgAdmin(memberDb as never, "org-1", "user-3")).resolves.toBe(false);
        await expect(isOrgAdmin(missingDb as never, "org-1", "user-4")).resolves.toBe(false);
    });

    it("checks paper authors with a projected select", async () => {
        const authorDb = createMockDb({ id: "paper-1" });
        const missingDb = createMockDb(null);

        await expect(isPaperAuthor(authorDb as never, "paper-1", "user-1")).resolves.toBe(true);
        await expect(isPaperAuthor(missingDb as never, "paper-1", "user-2")).resolves.toBe(false);
        expect(authorDb.select).toHaveBeenCalledWith(expect.objectContaining({ id: expect.anything() }));
    });

    it("checks paper uploaders with a projected select", async () => {
        const uploaderDb = createMockDb({ id: "paper-1" });
        const missingDb = createMockDb(null);

        await expect(isPaperUploader(uploaderDb as never, "paper-1", "user-1")).resolves.toBe(true);
        await expect(isPaperUploader(missingDb as never, "paper-1", "user-2")).resolves.toBe(false);
        expect(uploaderDb.select).toHaveBeenCalledWith(expect.objectContaining({ id: expect.anything() }));
    });

    it("checks membership through paper orgs with a projected select", async () => {
        const memberDb = createMockDb({ id: "user-1" });
        const missingDb = createMockDb(null);

        await expect(isMemberOfPaperOrg(memberDb as never, "paper-1", "user-1")).resolves.toBe(true);
        await expect(isMemberOfPaperOrg(missingDb as never, "paper-1", "user-2")).resolves.toBe(false);
        expect(memberDb.select).toHaveBeenCalledWith(expect.objectContaining({ id: expect.anything() }));
    });
});
