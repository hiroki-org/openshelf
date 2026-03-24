with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "r") as f:
    content = f.read()

# Replace the test
old_test = """  it("shows error when year is invalid", async () => {
    render(<PaperEditForm paperId="paper-1" initialData={defaultInitialData} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Valid Title" } });
    fireEvent.change(screen.getByLabelText(/発表年/i), { target: { value: "e" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("年は数値で入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });"""

new_test = """  it("shows error when year is invalid", async () => {
    // Override the component state by forcing an invalid year that parses as NaN
    render(<PaperEditForm paperId="paper-1" initialData={{...defaultInitialData, year: "NaN" as any}} />);

    fireEvent.change(screen.getByLabelText(/タイトル/i), { target: { value: "Valid Title" } });
    // This allows us to bypass the jsdom input type="number" quirks that wipe out invalid characters
    fireEvent.change(screen.getByLabelText(/発表年/i), { target: { value: "NaN" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("年は数値で入力してください。")).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });"""

with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "w") as f:
    f.write(content.replace(old_test, new_test))
