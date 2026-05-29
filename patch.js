const fs = require('fs');
let content = fs.readFileSync('apps/api/src/utils/__tests__/file.test.ts', 'utf8');

content = content.replace(
  `    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(validateMagicNumbers(errorFile, "application/pdf")).resolves.toBe(false);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error validating magic numbers:",
      expect.objectContaining({ name: "InvalidStateError" })
    );
    consoleSpy.mockRestore();`,
  `    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(validateMagicNumbers(errorFile, "application/pdf")).resolves.toBe(false);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error validating magic numbers:",
        expect.objectContaining({ name: "InvalidStateError" })
      );
    } finally {
      consoleSpy.mockRestore();
    }`
);

fs.writeFileSync('apps/api/src/utils/__tests__/file.test.ts', content);
