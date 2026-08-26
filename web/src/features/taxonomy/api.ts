import { apiFetch } from '../../shared/api/client';
import type { AdminDistrict, PublicConfig, TaxonomyInput } from './types';

export function getAdminDistricts(): Promise<AdminDistrict[]> {
  return apiFetch<AdminDistrict[]>('/api/admin/districts');
}

export function createDistrict(input: TaxonomyInput): Promise<AdminDistrict> {
  return apiFetch<AdminDistrict>('/api/admin/districts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDistrict(
  id: string,
  input: Partial<TaxonomyInput>,
): Promise<AdminDistrict> {
  return apiFetch<AdminDistrict>(`/api/admin/districts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getPublicConfig(): Promise<PublicConfig> {
  return apiFetch<PublicConfig>('/api/public/config');
}
