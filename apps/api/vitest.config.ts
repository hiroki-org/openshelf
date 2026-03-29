import { defineConfig, type UserConfig } from "vitest/config";

export default defineConfig(async (): Promise<UserConfig> => {
    const { default: codspeedPlugin } = await import("@codspeed/vitest-plugin");
    return {
    plugins: [codspeedPlugin()],
    test: {
        environment: "node",
        include: ["src/**/__tests__/**/*.test.ts"],
        reporters: ["default", "junit"],
        outputFile: {
            lcov: "./coverage/lcov.info",
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
    };
});
