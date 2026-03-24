import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "@/components/toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrgSettingsPage from "../page";
import { apiFetch } from "@/lib/api";

const push = vi.fn();
const replace = vi.fn();
let authState: any;
let initialTab = "general";

type OrgState = {
  org: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  };
  members: Array<{
    userId: string;
    role: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
    githubId: string;
  }>;
  papers: Array<{
    id: string;
    title: string;
    visibility: string;
    year: number | null;
    venue: string | null;
  }>;
};

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "demo-org" }),
  useRouter: () => ({ push, replace }),
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? initialTab : null),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={typeof src === "string" ? src : ""} alt={alt} {...props} />
  ),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function setupOrgApiMock(state: OrgState) {
  const userSearchResults = [
    {
      id: "user-3",
      name: "alicecat",
      displayName: "Alice Candidate",
      avatarUrl: null,
    },
  ];

  const searchablePapers = [
    {
      id: "paper-1",
      title: "Existing Paper",
      visibility: "public",
      year: 2025,
      venue: "Conf",
    },
    {
      id: "paper-2",
      title: "Transformer Tricks",
      visibility: "public",
      year: 2024,
      venue: "Journal",
    },
  ];

  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/orgs/demo-org" && method === "GET") {
      return jsonResponse({ org: state.org });
    }

    if (url === "/api/orgs/demo-org/members" && method === "GET") {
      return jsonResponse({ members: state.members });
    }

    if (url === "/api/orgs/demo-org/papers" && method === "GET") {
      return jsonResponse({ papers: state.papers });
    }

    if (url === "/api/orgs/demo-org" && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      state.org = {
        ...state.org,
        name: body.name,
        slug: body.slug,
        description: body.description,
      };
      return jsonResponse({ org: state.org });
    }

    if (url === "/api/orgs/demo-org" && method === "DELETE") {
      return jsonResponse({ ok: true });
    }

    if (url === "/api/users/search?q=al" && method === "GET") {
      return jsonResponse({
        users: userSearchResults.filter(
          (user) => !state.members.some((member) => member.userId === user.id),
        ),
      });
    }

    if (url === "/api/orgs/demo-org/members" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const candidate = userSearchResults.find((user) => user.id === body.userId);
      if (candidate) {
        state.members = [
          ...state.members,
          {
            userId: candidate.id,
            role: body.role,
            name: candidate.name,
            displayName: candidate.displayName,
            avatarUrl: candidate.avatarUrl,
            githubId: candidate.name,
          },
        ];
      }
      return jsonResponse({ ok: true });
    }

    if (url === "/api/orgs/demo-org/members/member-2" && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      state.members = state.members.map((member) =>
        member.userId === "member-2" ? { ...member, role: body.role } : member,
      );
      return jsonResponse({ ok: true });
    }

    if (url === "/api/orgs/demo-org/members/member-2" && method === "DELETE") {
      state.members = state.members.filter((member) => member.userId !== "member-2");
      return jsonResponse({ ok: true });
    }

    if (url === "/api/papers" && method === "GET") {
      return jsonResponse({ papers: searchablePapers });
    }

    if (url === "/api/orgs/demo-org/papers" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const paper = searchablePapers.find((entry) => entry.id === body.paperId);
      if (paper) {
        state.papers = [...state.papers, paper];
      }
      return jsonResponse({ ok: true });
    }

    if (url === "/api/orgs/demo-org/papers/paper-2" && method === "DELETE") {
      state.papers = state.papers.filter((paper) => paper.id !== "paper-2");
      return jsonResponse({ ok: true });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });
}

describe("OrgSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReset();
    replace.mockReset();
    initialTab = "general";
    authState = {
      user: { id: "owner-1", name: "owner", displayName: "Owner" },
      loading: false,
    };
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("saves general settings and routes to the renamed slug", async () => {
    setupOrgApiMock({
      org: {
        id: "org-1",
        slug: "demo-org",
        name: "Demo Org",
        description: "Original description",
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
      ],
      papers: [],
    });

    render(<OrgSettingsPage />);

    await screen.findByRole("heading", { name: "Demo Org — 設定" });

    fireEvent.change(screen.getByLabelText("組織名"), {
      target: { value: "Renamed Org" },
    });
    fireEvent.change(screen.getByLabelText("スラッグ"), {
      target: { value: "Renamed-Team!!" },
    });
    fireEvent.change(screen.getByLabelText("説明"), {
      target: { value: " Updated description " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("保存しました"));
    expect(replace).toHaveBeenCalledWith("/orgs/renamed-team/settings");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/orgs/demo-org",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Renamed Org",
          slug: "renamed-team",
          description: "Updated description",
        }),
      }),
    );
  });

  it("manages members and linked papers as an admin", async () => {
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
      papers: [
        {
          id: "paper-1",
          title: "Existing Paper",
          visibility: "public",
          year: 2025,
          venue: "Conf",
        },
      ],
    });

    render(<OrgSettingsPage />);

    await screen.findByRole("heading", { name: "Demo Org — 設定" });

    fireEvent.click(screen.getByRole("button", { name: "メンバー" }));
    fireEvent.change(screen.getByLabelText("メンバー検索"), {
      target: { value: "al" },
    });

    const candidateRow = (await screen.findByText("Alice Candidate")).closest("li");
    expect(candidateRow).not.toBeNull();
    fireEvent.click(
      within(candidateRow!).getByRole("button", { name: "追加" }),
    );

    await waitFor(() => {
      expect(screen.getByText("@alicecat")).toBeInTheDocument();
    });

    const bobRow = screen.getByText("Bob").closest("li");
    expect(bobRow).not.toBeNull();

    fireEvent.change(within(bobRow!).getByRole("combobox"), {
      target: { value: "admin" },
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/orgs/demo-org/members/member-2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "admin" }),
        }),
      );
    });

    fireEvent.click(within(bobRow!).getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "論文" }));
    fireEvent.change(screen.getByLabelText("論文検索"), {
      target: { value: "tr" },
    });

    const paperCandidateRow = (await screen.findByText("Transformer Tricks")).closest(
      "li",
    );
    expect(paperCandidateRow).not.toBeNull();
    fireEvent.click(
      within(paperCandidateRow!).getByRole("button", { name: "追加" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Transformer Tricks")).toBeInTheDocument();
    });

    const paperRow = screen.getByText("Transformer Tricks").closest("li");
    expect(paperRow).not.toBeNull();

    fireEvent.click(within(paperRow!).getByRole("button", { name: "解除" }));

    await waitFor(() => {
      expect(screen.queryByText("Transformer Tricks")).not.toBeInTheDocument();
    });
  });

  it("shows the delete confirmation flow and deletes the org", async () => {
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
      ],
      papers: [],
    });

    render(<OrgSettingsPage />);

    await screen.findByRole("heading", { name: "Demo Org — 設定" });
    fireEvent.click(screen.getByRole("button", { name: "組織を削除" }));

    fireEvent.change(screen.getByLabelText("削除確認のためスラッグを入力"), {
      target: { value: "demo-org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完全に削除する" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/");
    });
  });


  it("redirects guests away from the settings page", async () => {
    authState = { user: null, loading: false };
    render(<OrgSettingsPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("redirects non-admin members away from the settings page", async () => {
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
  });

  it("shows not found on 404", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 }));
    render(<OrgSettingsPage />);
    expect(await screen.findByText("組織が見つかりません")).toBeInTheDocument();
  });

  it("shows error on network failure", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Net Error"));
    render(<OrgSettingsPage />);
    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });

  it("handles save settings error", async () => {
    const state: OrgState = {
      org: { id: "o1", slug: "demo-org", name: "Org", description: null },
      members: [{ userId: "owner-1", role: "owner", name: "o", displayName: "O", avatarUrl: null, githubId: "o" }],
      papers: [],
    };
    
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (init?.method === "PATCH") return jsonResponse({ error: "Invalid slug" }, 400);
      if (String(url).includes("/api/orgs/demo-org")) {
          if (url === "/api/orgs/demo-org" && (!init || init.method === "GET")) return jsonResponse({ org: state.org });
          if (String(url).endsWith("/members")) return jsonResponse({ members: state.members });
          if (String(url).endsWith("/papers")) return jsonResponse({ papers: state.papers });
      }
      return jsonResponse({ error: "Unexpected" }, 500);
    });

    render(<OrgSettingsPage />);
    await screen.findByRole("heading", { name: "Org — 設定" });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Invalid slug"));

    const currentMock = vi.mocked(apiFetch).getMockImplementation();
    if (!currentMock) {
      throw new Error("Expected apiFetch mock implementation");
    }
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (init?.method === "PATCH") throw new Error("Net");
      return currentMock(url, init);
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ネットワークエラーが発生しました"));
  });

  it("handles member and paper operation errors", async () => {
    const state: OrgState = {
      org: { id: "o1", slug: "demo-org", name: "Org", description: null },
      members: [
        { userId: "owner-1", role: "owner", name: "o", displayName: "O", avatarUrl: null, githubId: "o" },
        { userId: "member-2", role: "member", name: "b", displayName: "B", avatarUrl: null, githubId: "b" }
      ],
      papers: [{ id: "p1", title: "P1", visibility: "public", year: null, venue: null }],
    };

    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
        if (String(url).includes("/api/orgs/demo-org")) {
            if (url === "/api/orgs/demo-org" && (!init || init.method === "GET")) return jsonResponse({ org: state.org });
            if (String(url).includes("/members")) {
                if (init?.method === "POST") return jsonResponse({ error: "User already member" }, 400);
                if (init?.method === "PATCH") return jsonResponse({ error: "Forbidden" }, 403);
                return jsonResponse({ members: state.members });
            }
            if (String(url).includes("/papers")) {
                if (init?.method === "DELETE") return jsonResponse({ error: "Not found" }, 404);
                return jsonResponse({ papers: state.papers });
            }
        }
        if (String(url).includes("/api/users/search")) return jsonResponse({ users: [{ id: "u3", name: "a", displayName: "Alice Candidate", avatarUrl: null }] });
        return jsonResponse({});
    });

    render(<OrgSettingsPage />);
    await screen.findByRole("heading", { name: "Org — 設定" });

    fireEvent.click(screen.getByRole("button", { name: "メンバー" }));
    fireEvent.change(screen.getByLabelText("メンバー検索"), { target: { value: "al" } });
    const addBtn = await screen.findByRole("button", { name: "追加" });
    fireEvent.click(addBtn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("User already member"));

    const roleSelect = await screen.findByDisplayValue("member");
    fireEvent.change(roleSelect, { target: { value: "admin" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Forbidden"));

    fireEvent.click(screen.getByRole("button", { name: "論文" }));
    fireEvent.click(screen.getByRole("button", { name: "解除" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not found"));

  });

  it("clears search results when query is too short", async () => {
    setupOrgApiMock({
      org: { id: "o1", slug: "demo-org", name: "Org", description: null },
      members: [{ userId: "owner-1", role: "owner", name: "o", displayName: "O", avatarUrl: null, githubId: "o" }],
      papers: [],
    });
    render(<OrgSettingsPage />);
    await screen.findByRole("heading", { name: "Org — 設定" });

    fireEvent.click(screen.getByRole("button", { name: "メンバー" }));
    fireEvent.change(screen.getByLabelText("メンバー検索"), { target: { value: "al" } });
    expect(await screen.findByText("Alice Candidate")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("メンバー検索"), { target: { value: "a" } });
    expect(screen.queryByText("Alice Candidate")).not.toBeInTheDocument();
  });

  it("handles delete failure and cancellation", async () => {
    setupOrgApiMock({
      org: { id: "o1", slug: "demo-org", name: "Org", description: null },
      members: [{ userId: "owner-1", role: "owner", name: "o", displayName: "O", avatarUrl: null, githubId: "o" }],
      papers: [],
    });
    render(<OrgSettingsPage />);
    await screen.findByRole("heading", { name: "Org — 設定" });

    fireEvent.click(screen.getByRole("button", { name: "組織を削除" }));
    
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByLabelText("削除確認のためスラッグを入力")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "組織を削除" }));
    fireEvent.change(screen.getByLabelText("削除確認のためスラッグを入力"), { target: { value: "demo-org" } });
    const originalMock = vi.mocked(apiFetch).getMockImplementation();
    if (!originalMock) {
      throw new Error("Expected apiFetch mock implementation");
    }
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (init?.method === "DELETE") return jsonResponse({ error: "Protected" }, 400);
      return originalMock(url, init);
    });
    fireEvent.click(screen.getByRole("button", { name: "完全に削除する" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Protected"));
  });
});

