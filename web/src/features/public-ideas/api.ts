import { apiFetch } from '../../shared/api/client';
import type {
  PublicIdeaDetail,
  PublicIdeaListResponse,
  PublicMapIdeasResponse,
} from './types';

export function getPublicIdeas(
  page = 1,
  pageSize = 50,
): Promise<PublicIdeaListResponse> {
  return apiFetch<PublicIdeaListResponse>(
    `/api/public/ideas?page=${page}&pageSize=${pageSize}`,
  );
}

export function getPublicIdeaDetail(slug: string): Promise<PublicIdeaDetail> {
  return apiFetch<PublicIdeaDetail>(
    `/api/public/ideas/${encodeURIComponent(slug)}`,
  );
}

export function getPublicMapIdeas(): Promise<PublicMapIdeasResponse> {
  return apiFetch<PublicMapIdeasResponse>('/api/public/map/ideas');
}
