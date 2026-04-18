import { bench, describe } from "vitest";
import { buildBadgeSvg, estimateTextWidth } from "../badge";

const benchmarkOptions = {
    time: 2000,
    warmupTime: 500,
    iterations: 25,
    warmupIterations: 10,
};

describe("badge benchmark", () => {
    bench("buildBadgeSvg", () => {
        buildBadgeSvg("📄 OpenShelf", "Balance Boundary Explorer (2026)", "4c1");
    }, benchmarkOptions);

    bench("estimateTextWidth", () => {
        estimateTextWidth("Balance Boundary Explorer (2026) 📄 OpenShelf 👍");
    }, benchmarkOptions);
});
