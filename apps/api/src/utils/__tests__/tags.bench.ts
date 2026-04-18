import { bench, describe } from "vitest";
import { parseStoredTags } from "../tags";

const benchmarkOptions = {
    time: 2000,
    warmupTime: 500,
    iterations: 25,
    warmupIterations: 10,
};

describe("tags benchmark", () => {
    bench("parseStoredTags with valid JSON array", () => {
        parseStoredTags('["tag1", "tag2", "tag3"]');
    }, benchmarkOptions);

    bench("parseStoredTags with empty string", () => {
        parseStoredTags("");
    }, benchmarkOptions);

    bench("parseStoredTags with null", () => {
        parseStoredTags(null);
    }, benchmarkOptions);

    bench("parseStoredTags with invalid JSON", () => {
        parseStoredTags('["tag1", "tag2", "tag3"');
    }, benchmarkOptions);
});
