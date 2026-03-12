import type { D1Database } from "@cloudflare/workers-types";

type PersistGitHubUserInput = {
    candidateUserId: string;
    githubId: string;
    name: string;
    avatarUrl: string | null;
    email: string | null;
    source: "oauth-callback" | "test-token";
};

type UsersTableInfoRow = {
    name: string;
};

type UsersIndexListRow = {
    name: string;
    unique: number;
};

type UsersIndexInfoRow = {
    name: string;
};

type D1QueryRunner = {
    prepare(query: string): {
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
};

const USER_PERSISTENCE_SESSION = "first-primary" as const;

const UPSERT_GITHUB_USER_SQL = `
    INSERT INTO users (id, github_id, name, avatar_url, email)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(github_id) DO UPDATE SET
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        email = excluded.email
`;

const UPSERT_GITHUB_USER_WITH_UPDATED_AT_SQL = `
    INSERT INTO users (id, github_id, name, avatar_url, email)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(github_id) DO UPDATE SET
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        email = excluded.email,
        updated_at = datetime('now')
`;

const SELECT_GITHUB_USER_ID_SQL = `
    SELECT id
    FROM users
    WHERE github_id = ?1
`;

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

const readUsersTableColumns = async (db: D1QueryRunner) => {
    const columnResult = await db.prepare("PRAGMA table_info(users)").all<UsersTableInfoRow>();
    return columnResult.results.map((row) => row.name);
};

const detectUsersUpdatedAtColumn = async (db: D1Database) => {
    try {
        const columns = await readUsersTableColumns(db);
        return columns.includes("updated_at");
    } catch {
        return false;
    }
};

const readUsersSchemaDiagnostics = async (db: D1Database) => {
    try {
        const columns = await readUsersTableColumns(db);

        const indexListResult = await db
            .prepare("PRAGMA index_list(users)")
            .all<UsersIndexListRow>();
        const uniqueIndexes = await Promise.all(
            indexListResult.results
                .filter((row) => Number(row.unique) === 1)
                .map(async (row) => {
                    const safeIndexName = row.name.replace(/"/g, "\"\"");
                    const indexInfoResult = await db
                        .prepare(`PRAGMA index_info("${safeIndexName}")`)
                        .all<UsersIndexInfoRow>();
                    const indexColumns = indexInfoResult.results.map(
                        (infoRow) => infoRow.name,
                    );

                    return {
                        name: row.name,
                        columns: indexColumns,
                    };
                }),
        );

        return {
            columns,
            uniqueIndexes: uniqueIndexes.map(
                (index) => `${index.name}(${index.columns.join(",")})`,
            ),
            hasUpdatedAtColumn: columns.includes("updated_at"),
            hasGithubIdUniqueIndex: uniqueIndexes.some(
                (index) =>
                    index.columns.length === 1 &&
                    index.columns[0] === "github_id",
            ),
        };
    } catch (error) {
        return {
            diagnosticsError: getErrorMessage(error),
        };
    }
};

const logPersistenceFailure = async (
    db: D1Database,
    input: PersistGitHubUserInput,
    error: unknown,
    stage: "upsert" | "reselect",
) => {
    const diagnostics = await readUsersSchemaDiagnostics(db);

    console.error(`GitHub user persistence failed during ${stage}`, {
        source: input.source,
        githubId: input.githubId,
        session: USER_PERSISTENCE_SESSION,
        error: getErrorMessage(error),
        ...diagnostics,
    });
};

export async function persistGitHubUser(
    db: D1Database,
    input: PersistGitHubUserInput,
): Promise<{ userId: string }> {
    const hasUpdatedAtColumn = await detectUsersUpdatedAtColumn(db);
    const session = db.withSession(USER_PERSISTENCE_SESSION);
    const upsertSql = hasUpdatedAtColumn
        ? UPSERT_GITHUB_USER_WITH_UPDATED_AT_SQL
        : UPSERT_GITHUB_USER_SQL;

    try {
        await session
            .prepare(upsertSql)
            .bind(
                input.candidateUserId,
                input.githubId,
                input.name,
                input.avatarUrl,
                input.email,
            )
            .run();
    } catch (error) {
        await logPersistenceFailure(db, input, error, "upsert");
        throw error;
    }

    const persistedUser = await session
        .prepare(SELECT_GITHUB_USER_ID_SQL)
        .bind(input.githubId)
        .first<{ id: string }>();

    if (!persistedUser?.id) {
        const error = new Error("GitHub user row was not visible after persistence");
        await logPersistenceFailure(db, input, error, "reselect");
        throw error;
    }

    return {
        userId: persistedUser.id,
    };
}
