const fs = require('fs');

let code = fs.readFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', 'utf8');

const origGuestTest = `
  it("redirects guests and non-admin members away from the settings page", async () => {
    // 1. Unauthenticated guest
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");

    push.mockClear();

    // 2. Non-admin member
    cleanup();
    vi.clearAllMocks();
    if (vi.mocked(toast.success)) vi.mocked(toast.success).mockClear();
    if (vi.mocked(toast.error)) vi.mocked(toast.error).mockClear();

    authState = {
      user: { id: "member-2", name: "bob", displayName: "Bob" },
      loading: false,
    };
    mockApiData({
      org: {
        id: "org-1",
        slug: "demo-org",
        name: "Demo Org",
        description: null,
      },
      members: [
        {
          userId: "user-1",
          role: "admin",
          name: "alice",
          displayName: "Alice",
          avatarUrl: null,
          githubId: "alice",
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
  });
`;

const newGuestTest = `
  it("redirects guests away from the settings page", () => {
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin members away from the settings page", async () => {
    authState = {
      user: { id: "member-2", name: "bob", displayName: "Bob" },
      loading: false,
    };
    mockApiData({
      org: {
        id: "org-1",
        slug: "demo-org",
        name: "Demo Org",
        description: null,
      },
      members: [
        {
          userId: "user-1",
          role: "admin",
          name: "alice",
          displayName: "Alice",
          avatarUrl: null,
          githubId: "alice",
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
  });
`;

if (code.includes(origGuestTest.trim())) {
  code = code.replace(origGuestTest.trim(), newGuestTest.trim());
} else {
  // Use regex
  const regex = /  it\("redirects guests and non-admin members away from the settings page", async \(\) => \{[\s\S]+?\}\);\n/g;
  const match = code.match(regex);
  if (match) {
    code = code.replace(match[0], newGuestTest + '\n');
  }
}

fs.writeFileSync('apps/web/src/app/orgs/[slug]/settings/__tests__/page.test.tsx', code);
