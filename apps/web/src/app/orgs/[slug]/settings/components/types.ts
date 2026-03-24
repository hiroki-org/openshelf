export type Org = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type Member = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

export type SearchUser = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type OrgPaper = {
  id: string;
  title: string;
  visibility: string;
  year: number | null;
  venue: string | null;
};
