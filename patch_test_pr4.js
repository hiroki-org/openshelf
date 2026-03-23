const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

const regex = /  it\("redirects guests away from the settings page", \(\) => \{[\s\S]+?\}\);\s+it\("redirects non-admin members away from the settings page", async \(\) => \{[\s\S]+?\}\);\s+cleanup\(\);[\s\S]+?await waitFor\(\(\) => \{\s+expect\(push\)\.toHaveBeenCalledWith\("\/orgs\/demo-org"\);\s+\}\);\s+\}\);/;

const newTests = `  it("redirects guests away from the settings page", () => {
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin members away from the settings page", async () => {
    cleanup();
    vi.clearAllMocks();
    if (vi.mocked(toast.success)) vi.mocked(toast.success).mockClear();
    if (vi.mocked(toast.error)) vi.mocked(toast.error).mockClear();

    authState = {
      user: { id: "member-2", name: "bob", displayName: "Bob" },
      loading: false,
    };
    setupOrgApiMock({
      org: {
        id: "org-1",
        slug: "demo-org",
        name: "Demo Org",
        description: null,
      },
      members: [
        {
          userId: "owner-1",
          role: "owner",
          name: "owner",
          displayName: "Owner",
          avatarUrl: null,
          githubId: "owner",
        },
        {
          userId: "member-2",
          role: "member",
          name: "bob",
          displayName: "Bob",
          avatarUrl: null,
          githubId: "bob",
        },
      ],
      papers: [],
    });

    render(<OrgSettingsPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/orgs/demo-org");
    });
  });`;

if (code.match(regex)) {
  code = code.replace(regex, newTests);
  fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
  console.log("Success");
} else {
  console.log("Regex didn't match");
}
