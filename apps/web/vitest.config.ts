import { defineConfig, type ViteUserConfig } from "vitest/config";
import path from "node:path";

export default defineConfig(async (): Promise<ViteUserConfig> => {
    const { default: codspeedPlugin } = await import("@codspeed/vitest-plugin");
    return {
    plugins: [codspeedPlugin()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
        reporters: ["default", "junit"],
        outputFile: {
            lcov: "./coverage/lcov.info",
            junit: "./test-report.junit.xml",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "./coverage"
        }
    }
    };
});
