export type Org = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type OrgPaper = {
  id: string;
  title: string;
  abstract: string | null;
  visibility: string;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
};

export type Member = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string;
};

export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
};
