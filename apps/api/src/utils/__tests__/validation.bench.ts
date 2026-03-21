import { bench, describe } from "vitest";
import {
    validateDescription,
    validateName,
    validateSlug,
} from "../validation";

describe("validation benchmarks", () => {
    bench("validateSlug valid short", () => {
        validateSlug("open-shelf");
    });

    bench("validateSlug valid max length", () => {
        validateSlug("a".repeat(40));
    });

    bench("validateSlug invalid uppercase", () => {
        validateSlug("OpenShelf");
    });

    bench("validateSlug invalid symbol", () => {
        validateSlug("open_shelf");
    });

    bench("validateSlug batch mixed", () => {
        const values = ["paper-1", "paper-2", "paper--3", "Paper4", "p5"];
        for (const value of values) {
            validateSlug(value);
        }
    });

    bench("validateName valid", () => {
        validateName("OpenShelf Research Group");
    });

    bench("validateName invalid empty", () => {
        validateName("   ");
    });

    bench("validateName invalid too long", () => {
        validateName("a".repeat(101));
    });

    bench("validateName batch mixed", () => {
        const values = ["Alice", "  ", "Bob", "a".repeat(101), "Carol"];
        for (const value of values) {
            validateName(value);
        }
    });

    bench("validateDescription null", () => {
        validateDescription(null);
    });

    bench("validateDescription valid", () => {
        validateDescription("This is a short description.");
    });

    bench("validateDescription invalid type", () => {
        validateDescription(12345);
    });

    bench("validateDescription invalid too long", () => {
        validateDescription("a".repeat(501));
    });

    bench("validateDescription batch mixed", () => {
        const values: unknown[] = [
            null,
            "",
            "A valid description",
            999,
            "a".repeat(501),
        ];
        for (const value of values) {
            validateDescription(value);
        }
    });
});
