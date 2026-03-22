import { bench, describe } from "vitest";
import {
    validateDescription,
    validateName,
    validateSlug,
} from "../validation";

const maxLengthSlug = "a".repeat(40);
const tooLongName = "a".repeat(101);
const tooLongDescription = "a".repeat(501);

describe("validation benchmarks", () => {
    bench("validateSlug valid short", () => {
        validateSlug("open-shelf");
    });

    bench("validateSlug valid max length", () => {
        validateSlug(maxLengthSlug);
    });

    bench("validateSlug invalid uppercase", () => {
        validateSlug("OpenShelf");
    });

    bench("validateSlug invalid symbol", () => {
        validateSlug("open_shelf");
    });

    bench("validateSlug invalid consecutive hyphens", () => {
        validateSlug("paper--3");
    });

    bench("validateName valid", () => {
        validateName("OpenShelf Research Group");
    });

    bench("validateName invalid empty", () => {
        validateName("   ");
    });

    bench("validateName invalid too long", () => {
        validateName(tooLongName);
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
        validateDescription(tooLongDescription);
    });
});
