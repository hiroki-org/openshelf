import { bench, describe } from "vitest";
import { parseStoredTags } from "../tags";
import { benchmarkOptions } from "./bench-utils";

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
