import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockD1 } from "../../test/helpers";
import { persistGitHubUser } from "../user-persistence";

describe("persistGitHubUser", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("uses a primary-anchored D1 session and returns the persisted user id", async () => {
        const { db, withSession } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    return {
                        run: async () => ({ results: [] }),
                    };
                }
                if (query.includes("SELECT id")) {
                    return {
                        first: async () => ({ id: "persisted-user-1" }),
                    };
                }
            },
        });

        const result = await persistGitHubUser(db, {
            candidateUserId: "candidate-user-1",
            githubId: "123",
            name: "Octo Cat",
            avatarUrl: "https://example.com/avatar.png",
            email: "octo@example.com",
            source: "oauth-callback",
        });

        expect(result).toEqual({ userId: "persisted-user-1" });
        expect(withSession).toHaveBeenCalledWith("first-primary");
    });

    it("updates updated_at on conflict when the column exists", async () => {
        let upsertQuery = "";
        const { db } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    upsertQuery = query;
                    return {
                        run: async () => ({ results: [] }),
                    };
                }
                if (query.includes("SELECT id")) {
                    return {
                        first: async () => ({ id: "persisted-user-1" }),
                    };
                }
            },
            dbHandler: (query) => {
                if (query === "PRAGMA table_info(users)") {
                    return {
                        all: async () => ({
                            results: [
                                { name: "id" },
                                { name: "github_id" },
                                { name: "name" },
                                { name: "avatar_url" },
                                { name: "email" },
                                { name: "created_at" },
                                { name: "updated_at" },
                            ],
                        }),
                    };
                }
            },
        });

        await persistGitHubUser(db, {
            candidateUserId: "candidate-user-1",
            githubId: "123",
            name: "Octo Cat",
            avatarUrl: null,
            email: null,
            source: "oauth-callback",
        });

        expect(upsertQuery).toContain("updated_at = datetime('now')");
    });

    it("logs schema diagnostics when the users github_id conflict target is missing", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { db } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    return {
                        run: async () => {
                            throw new Error(
                                "D1_ERROR: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint",
                            );
                        },
                    };
                }
            },
            dbHandler: (query) => {
                if (query === "PRAGMA table_info(users)") {
                    return {
                        all: async () => ({
                            results: [
                                { name: "id" },
                                { name: "github_id" },
                                { name: "name" },
                                { name: "avatar_url" },
                                { name: "email" },
                                { name: "created_at" },
                            ],
                        }),
                    };
                }
                if (query === "PRAGMA index_list(users)") {
                    return {
                        all: async () => ({
                            results: [],
                        }),
                    };
                }
            },
        });

        await expect(
            persistGitHubUser(db, {
                candidateUserId: "candidate-user-1",
                githubId: "123",
                name: "Octo Cat",
                avatarUrl: null,
                email: null,
                source: "oauth-callback",
            }),
        ).rejects.toThrow("ON CONFLICT clause does not match");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "GitHub user persistence failed during upsert",
            expect.objectContaining({
                source: "oauth-callback",
                githubId: "123",
                hasUpdatedAtColumn: false,
                hasGithubIdUniqueIndex: false,
            }),
        );
    });

    it("logs when the post-upsert reselect still returns no row", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { db } = createMockD1({
            sessionHandler: (query) => {
                if (query.includes("INSERT INTO users")) {
                    return {
                        run: async () => ({ results: [] }),
                    };
                }
                if (query.includes("SELECT id")) {
                    return {
                        first: async () => null,
                    };
                }
            },
            dbHandler: (query) => {
                if (query === "PRAGMA table_info(users)") {
                    return {
                        all: async () => ({
                            results: [
                                { name: "id" },
                                { name: "github_id" },
                                { name: "name" },
                                { name: "avatar_url" },
                                { name: "email" },
                                { name: "created_at" },
                                { name: "updated_at" },
                            ],
                        }),
                    };
                }
                if (query === "PRAGMA index_list(users)") {
                    return {
                        all: async () => ({
                            results: [{ name: "users_github_id_unique", unique: 1 }],
                        }),
                    };
                }
                if (query.includes('PRAGMA index_info("users_github_id_unique")')) {
                    return {
                        all: async () => ({
                            results: [{ name: "github_id" }],
                        }),
                    };
                }
            },
        });

        await expect(
            persistGitHubUser(db, {
                candidateUserId: "candidate-user-1",
                githubId: "123",
                name: "Octo Cat",
                avatarUrl: null,
                email: null,
                source: "oauth-callback",
            }),
        ).rejects.toThrow("not visible after persistence");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "GitHub user persistence failed during reselect",
            expect.objectContaining({
                source: "oauth-callback",
                githubId: "123",
                hasUpdatedAtColumn: true,
                hasGithubIdUniqueIndex: true,
            }),
        );
    });
});
