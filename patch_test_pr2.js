const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

const regex = /  it\("redirects guests and non-admin members away from the settings page", async \(\) => \{\s+\/\/ 1\. Unauthenticated guest\s+authState = \{ user: null, loading: false \};\s+render\(<OrgSettingsPage \/>\);\s+expect\(push\)\.toHaveBeenCalledWith\("\/"\);\s+push\.mockClear\(\);\s+\/\/ 2\. Non-admin member\s+authState = \{ user: \{ id: "user2" \}, loading: false \};\s+render\(<OrgSettingsPage \/>\);\s+await waitFor\(\(\) => expect\(push\)\.toHaveBeenCalledWith\("\/orgs\/demo-org"\)\);\s+\}\);/;

const newGuestTest = `  it("redirects guests away from the settings page", () => {
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin members away from the settings page", async () => {
    authState = { user: { id: "user2" }, loading: false };
    render(<OrgSettingsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orgs/demo-org"));
  });`;

if (code.match(regex)) {
  code = code.replace(regex, newGuestTest);
  fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
  console.log("Successfully patched page.test.tsx");
} else {
  console.log("Could not find the original test block to patch.");
}
