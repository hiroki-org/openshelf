import { bench, describe } from "vitest";
import { isAllowedOrigin } from "../origin";
import { benchmarkOptions } from "./bench-utils";

describe("origin benchmark", () => {
    const allowedOrigins = [
        "https://openshelf.example",
        "https://*.openshelf.example",
        "http://localhost:3000",
    ];

    bench("isAllowedOrigin exact match", () => {
        isAllowedOrigin("https://openshelf.example", "https://openshelf.example", allowedOrigins);
    }, benchmarkOptions);

    bench("isAllowedOrigin wildcard match", () => {
        isAllowedOrigin("https://app.openshelf.example", "https://openshelf.example", allowedOrigins);
    }, benchmarkOptions);
});
