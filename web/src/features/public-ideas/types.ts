export interface PublicIdeaListItem {
  slug: string;
  title: string;
  authorName: string;
  publishedAt: string | null;
  territory: string | null;
  voteCount: number;
  thumbnailUrl: string | null;
}

export interface PublicIdeaListResponse {
  items: PublicIdeaListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicIdeaDetail {
  slug: string;
  title: string;
  description: string;
  authorName: string;
  territory: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null;
  voteCount: number;
  image: { url: string } | null;
}

export interface PublicMapIdea {
  slug: string;
  title: string;
  authorName: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string | null;
}

export interface PublicMapIdeasResponse {
  items: PublicMapIdea[];
}
