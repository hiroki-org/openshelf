const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

// The test splits "redirects guests and non-admin members away from the settings page"
// into two distinct tests.
const origGuestTest = `
  it("redirects guests and non-admin members away from the settings page", async () => {
    // 1. Unauthenticated guest
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");

    push.mockClear();

    // 2. Non-admin member
    authState = { user: { id: "user2" }, loading: false };
    render(<OrgSettingsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orgs/demo-org"));
  });
`;

const newGuestTest = `
  it("redirects guests away from the settings page", () => {
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin members away from the settings page", async () => {
    authState = { user: { id: "user2" }, loading: false };
    render(<OrgSettingsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orgs/demo-org"));
  });
`;

if (code.includes(origGuestTest.trim())) {
  code = code.replace(origGuestTest.trim(), newGuestTest.trim());
} else {
  // If it doesn't match exactly, find by title
  const regex = /  it\("redirects guests and non-admin members away from the settings page", async \(\) => \{[\s\S]+?\}\);\n/;
  const match = code.match(regex);
  if (match) {
    code = code.replace(match[0], newGuestTest + '\n');
  }
}

fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
