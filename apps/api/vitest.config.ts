import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        env: { NODE_ENV: "test" },
        testTimeout: 10000,
        testTimeout: 10000,
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
