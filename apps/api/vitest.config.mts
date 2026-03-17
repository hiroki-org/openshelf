import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
    test: {
        pool: "@cloudflare/vitest-pool-workers",
        poolOptions: {
            workers: {
                wrangler: { configPath: "./wrangler.toml" },
            },
        },
        include: ["src/**/__tests__/**/*.test.ts"],
        reporters: ["default", "junit"],
        outputFile: {
            junit: "./test-report.junit.xml",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.ts"],
            exclude: ["src/types.ts", "**/coverage/**"],
        }
    }
});
