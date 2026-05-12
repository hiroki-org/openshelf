import { defineConfig } from "vitest/config";

const coverageEnabled = process.argv.includes("--coverage");

export default defineConfig({
    test: {
        projects: ["apps/api/vitest.config.ts", "apps/web/vitest.config.ts"],
        coverage: {
            enabled: coverageEnabled,
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "./coverage",
            include: [
                "apps/api/src/**/*.ts",
                "apps/web/src/**/*.ts",
                "apps/web/src/**/*.tsx",
            ],
            exclude: [
                "apps/api/src/types.ts",
                "**/coverage/**",
                "apps/e2e/**",
                "**/*.bench.ts",
                "**/bench-utils.ts"
            ],
        }
    }
});
