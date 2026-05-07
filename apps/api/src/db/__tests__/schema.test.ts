import { describe, expect, it, vi } from "vitest";
import {
  VALID_CATEGORIES,
  VALID_VENUE_TYPES,
  coauthorInvites,
  collectionPapers,
  collections,
  enableForeignKeys,
  orgMembers,
  orgs,
  paperAuthors,
  paperFiles,
  paperOrgs,
  paperStatsDaily,
  paperStatsDedup,
  paperStatsTotal,
  paperViews,
  papers,
  touchUpdatedAt,
  users,
} from "../schema";

describe("db schema", () => {
  it("exports expected enums", () => {
    expect(VALID_VENUE_TYPES).toEqual(["conference", "journal", "workshop", "other"]);
    expect(VALID_CATEGORIES).toEqual([
      "thesis_bachelor",
      "thesis_master",
      "report",
      "presentation",
      "other",
    ]);
  });

  it("exports all core table definitions", () => {
    expect(users).toBeDefined();
    expect(papers).toBeDefined();
    expect(paperViews).toBeDefined();
    expect(paperStatsDaily).toBeDefined();
    expect(paperStatsTotal).toBeDefined();
    expect(paperStatsDedup).toBeDefined();
    expect(paperFiles).toBeDefined();
    expect(paperAuthors).toBeDefined();
    expect(orgs).toBeDefined();
    expect(orgMembers).toBeDefined();
    expect(paperOrgs).toBeDefined();
    expect(collections).toBeDefined();
    expect(collectionPapers).toBeDefined();
    expect(coauthorInvites).toBeDefined();
  });

  it("touchUpdatedAt returns an updatedAt expression", () => {
    const result = touchUpdatedAt();
    expect(result).toHaveProperty("updatedAt");
  });

  it("enableForeignKeys executes PRAGMA query", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await enableForeignKeys({ run } as any);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
