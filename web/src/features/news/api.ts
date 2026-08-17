import { apiFetch } from '../../shared/api/client';
import type {
  AdminNewsDetail,
  AdminNewsListResponse,
  CreateNewsInput,
  PublicNewsDetail,
  PublicNewsListResponse,
  UpdateNewsInput,
} from './types';

export function getAdminNews(): Promise<AdminNewsListResponse> {
  return apiFetch<AdminNewsListResponse>('/api/admin/news');
}

export function getAdminNewsItem(id: string): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}`);
}

export function createNews(input: CreateNewsInput): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>('/api/admin/news', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateNews(
  id: string,
  input: UpdateNewsInput,
): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishNews(id: string): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}/publish`, {
    method: 'POST',
  });
}

export function unpublishNews(id: string): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}/unpublish`, {
    method: 'POST',
  });
}

export function uploadNewsImage(
  id: string,
  file: File,
): Promise<AdminNewsDetail> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}/image`, {
    method: 'POST',
    body,
  });
}

export function deleteNewsImage(id: string): Promise<AdminNewsDetail> {
  return apiFetch<AdminNewsDetail>(`/api/admin/news/${id}/image`, {
    method: 'DELETE',
  });
}

export function getPublicNews(): Promise<PublicNewsListResponse> {
  return apiFetch<PublicNewsListResponse>('/api/public/news?page=1&pageSize=50');
}

export function getPublicNewsDetail(slug: string): Promise<PublicNewsDetail> {
  return apiFetch<PublicNewsDetail>(
    `/api/public/news/${encodeURIComponent(slug)}`,
  );
}
