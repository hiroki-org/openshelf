import { bench, describe } from "vitest";
import { isAllowedOrigin } from "../origin";

const benchmarkOptions = {
    time: 2000,
    warmupTime: 500,
    iterations: 25,
    warmupIterations: 10,
};

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
