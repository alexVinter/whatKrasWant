import { apiFetch } from '../../shared/api/client';
import type {
  CreateIdeaInput,
  IdeaDetail,
  IdeaListFilters,
  IdeaListResponse,
  IdeaRevisionItem,
  IdeaSummary,
  UpdateIdeaInput,
} from './types';

function buildQuery(filters: IdeaListFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.territory) params.set('territory', filters.territory);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getIdeas(
  filters: IdeaListFilters = {},
): Promise<IdeaListResponse> {
  return apiFetch<IdeaListResponse>(`/api/admin/ideas${buildQuery(filters)}`);
}

export function getIdeasSummary(): Promise<IdeaSummary> {
  return apiFetch<IdeaSummary>('/api/admin/ideas/summary');
}

export function getIdea(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}`);
}

export function getIdeaRevisions(id: string): Promise<IdeaRevisionItem[]> {
  return apiFetch<IdeaRevisionItem[]>(`/api/admin/ideas/${id}/revisions`);
}

export function createIdea(input: CreateIdeaInput): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>('/api/admin/ideas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateIdea(
  id: string,
  input: UpdateIdeaInput,
): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishIdea(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/publish`, {
    method: 'POST',
  });
}

export function unpublishIdea(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/unpublish`, {
    method: 'POST',
  });
}

export function archiveIdea(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/archive`, {
    method: 'POST',
  });
}

export function restoreIdea(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/restore`, {
    method: 'POST',
  });
}

export function uploadIdeaImage(id: string, file: File): Promise<IdeaDetail> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/image`, {
    method: 'POST',
    body,
  });
}

export function deleteIdeaImage(id: string): Promise<IdeaDetail> {
  return apiFetch<IdeaDetail>(`/api/admin/ideas/${id}/image`, {
    method: 'DELETE',
  });
}
