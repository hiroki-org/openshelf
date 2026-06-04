export type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  description: string | null;
  descriptionUpdatedAt: string | null;
  visibility: string;
  showViewCount: boolean;
  publicViewCount: number | null;
  publicDownloadCount: number | null;
  externalUrl: string | null;
  venue: string | null;
  venueType: string | null;
  year: number | null;
  category: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaperFile = {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  mimeType: string | null;
  downloadUrl: string;
};

export type Author = {
  userId: string;
  role: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Invite = {
  id: string;
  inviteeId: string | null;
  inviteeName: string;
  status: string;
  createdAt: string;
};

export type SearchUser = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type PreviewResponse = {
  url: string;
  mimeType: string;
  filename: string;
};

export type PaperStats = {
  total: {
    views: number;
    downloads: number;
    previews: number;
  };
  daily: Array<{
    date: string;
    views: number;
    downloads: number;
    previews: number;
  }>;
  days: 7 | 30 | 90 | 365;
};
