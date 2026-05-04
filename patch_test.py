with open("apps/web/src/components/__tests__/toast.test.tsx", "r") as f:
    content = f.read()

new_test = """
  it("generates IDs when crypto.randomUUID is not available", () => {
    // Mock crypto.randomUUID to be undefined
    const originalCrypto = global.crypto;
    Object.defineProperty(global, "crypto", {
      value: { ...originalCrypto, randomUUID: undefined },
      writable: true,
    });

    render(<ToastContainer />);

    act(() => {
      toast.success("no-crypto-toast");
    });

    expect(screen.getByText("no-crypto-toast")).toBeInTheDocument();

    // Restore crypto
    Object.defineProperty(global, "crypto", {
      value: originalCrypto,
      writable: true,
    });
  });
"""

# replace the last "});" with "  " + new_test + "\n});"
parts = content.rsplit("});", 1)
content = parts[0] + new_test + "});" + parts[1]

with open("apps/web/src/components/__tests__/toast.test.tsx", "w") as f:
    f.write(content)
