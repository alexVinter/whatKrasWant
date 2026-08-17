import { apiFetch } from '../../shared/api/client';
import type { AuditListQuery, AuditListResponse } from './types';

function buildQuery(query: AuditListQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function getAuditLog(
  query: AuditListQuery = {},
): Promise<AuditListResponse> {
  return apiFetch<AuditListResponse>(`/api/admin/audit${buildQuery(query)}`);
}
