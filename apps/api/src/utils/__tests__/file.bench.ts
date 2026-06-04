import { bench, describe } from "vitest";
import { validateMagicNumbers } from "../file";
import { benchmarkOptions } from "./bench-utils";

describe("file extensions benchmark", () => {
  // Create dummy File objects once so the benchmark measures validation only.
  const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const pdfFile = new File([pdfMagic], "sample.pdf", {
    type: "application/pdf",
  });

  bench(
    "validateMagicNumbers pdf",
    async () => {
      await validateMagicNumbers(pdfFile, "application/pdf");
    },
    benchmarkOptions,
  );

  const pngMagic = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const pngFile = new File([pngMagic], "image.png", { type: "image/png" });

  bench(
    "validateMagicNumbers png",
    async () => {
      await validateMagicNumbers(pngFile, "image/png");
    },
    benchmarkOptions,
  );
});
