export type NewsStatus = 'DRAFT' | 'PUBLISHED';

export interface NewsImageInfo {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export interface AdminNewsListItem {
  id: string;
  title: string;
  slug: string;
  publishDate: string | null;
  status: NewsStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNewsDetail extends AdminNewsListItem {
  body: string;
  image: NewsImageInfo | null;
}

export interface AdminNewsListResponse {
  items: AdminNewsListItem[];
}

export interface CreateNewsInput {
  action: 'DRAFT' | 'PUBLISH';
  title: string;
  body: string;
  publishDate?: string | null;
}

export interface UpdateNewsInput {
  title?: string;
  body?: string;
  publishDate?: string | null;
}

export interface PublicNewsListItem {
  slug: string;
  title: string;
  publishDate: string | null;
  thumbnailUrl: string | null;
}

export interface PublicNewsListResponse {
  items: PublicNewsListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicNewsDetail {
  slug: string;
  title: string;
  body: string;
  publishDate: string | null;
  image: { url: string } | null;
}
