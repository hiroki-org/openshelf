import { bench, describe } from "vitest";
import { buildBadgeSvg, estimateTextWidth } from "../badge";
import { benchmarkOptions } from "./bench-utils";

describe("badge benchmark", () => {
    bench("buildBadgeSvg", () => {
        buildBadgeSvg("📄 OpenShelf", "Balance Boundary Explorer (2026)", "4c1");
    }, benchmarkOptions);

    bench("estimateTextWidth", () => {
        estimateTextWidth("Balance Boundary Explorer (2026) 📄 OpenShelf 👍");
    }, benchmarkOptions);
});
