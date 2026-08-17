import { apiFetch } from '../../shared/api/client';
import type { AdminSettings } from './types';

export function getAdminSettings(): Promise<AdminSettings> {
  return apiFetch<AdminSettings>('/api/admin/settings');
}

export function updateAdminSettings(
  input: AdminSettings,
): Promise<AdminSettings> {
  return apiFetch<AdminSettings>('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
