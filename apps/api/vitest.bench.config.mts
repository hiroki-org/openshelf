import { defineConfig } from "vitest/config";
import codspeedPlugin from "@codspeed/vitest-plugin";

export default defineConfig({
    plugins: [codspeedPlugin()],
    benchmark: {
        include: ["src/**/__tests__/**/*.bench.ts"],
    },
});
