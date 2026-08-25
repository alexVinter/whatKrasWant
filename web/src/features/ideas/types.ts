export type IdeaStatus = 'DRAFT' | 'MODERATION' | 'PUBLISHED' | 'ARCHIVED';
export type TerritoryType = 'DISTRICTS' | 'CITYWIDE';
export type SourceType = 'EXPERT' | 'RESIDENT';

export interface IdeaTopicRef {
  id: string;
  name: string;
  slug: string;
}

export interface IdeaListItem {
  id: string;
  publicNumber: number;
  title: string;
  sourceType: SourceType;
  expertName: string | null;
  category: { id: string; name: string } | null;
  topic: IdeaTopicRef | null;
  territoryType: TerritoryType;
  districts: { id: string; name: string }[];
  status: IdeaStatus;
  updatedAt: string;
}

export interface IdeaListResponse {
  items: IdeaListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IdeaImageInfo {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export interface IdeaDetail {
  id: string;
  publicNumber: number;
  slug: string;
  sourceType: SourceType;
  expertName: string | null;
  expertOrg: string | null;
  title: string;
  description: string;
  categoryId: string | null;
  category: { id: string; name: string; isActive: boolean } | null;
  topicId: string | null;
  topic: IdeaTopicRef | null;
  territoryType: TerritoryType;
  districts: { id: string; name: string }[];
  districtIds: string[];
  hasSpecificPlace: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: IdeaStatus;
  isTop20: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  image: IdeaImageInfo | null;
}

export interface IdeaRevisionItem {
  id: string;
  reason: string | null;
  createdAt: string;
  actor: { id: string; login: string } | null;
  snapshot: unknown;
}

export interface IdeaSummary {
  total: number;
  draft: number;
  published: number;
  archived: number;
}

export interface CreateIdeaInput {
  action: 'DRAFT' | 'PUBLISH';
  expertName?: string;
  expertOrg?: string;
  title: string;
  description: string;
  categoryId?: string | null;
  topicId?: string | null;
  territoryType: TerritoryType;
  districtIds?: string[];
  hasSpecificPlace: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateIdeaInput {
  expertName?: string;
  expertOrg?: string;
  title?: string;
  description?: string;
  categoryId?: string | null;
  topicId?: string | null;
  territoryType?: TerritoryType;
  districtIds?: string[];
  hasSpecificPlace?: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

export interface IdeaListFilters {
  search?: string;
  status?: IdeaStatus;
  categoryId?: string;
  territory?: string;
  page?: number;
  pageSize?: number;
}
