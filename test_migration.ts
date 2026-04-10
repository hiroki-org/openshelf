import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
    "users",
    {
        githubId: text("github_id").notNull(),
        name: text("name").notNull(),
        displayName: text("display_name"),
    },
    (t) => [
        uniqueIndex("users_github_id_idx").on(t.githubId),
        index("users_name_idx").on(t.name),
        index("users_display_name_idx").on(t.displayName),
    ]
);
