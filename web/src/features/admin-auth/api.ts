import { apiFetch } from '../../shared/api/client';
import type { AdminLoginInput, AdminSessionResponse } from './types';

export function loginAdmin(
  input: AdminLoginInput,
): Promise<AdminSessionResponse> {
  return apiFetch<AdminSessionResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAdminSession(): Promise<AdminSessionResponse> {
  return apiFetch<AdminSessionResponse>('/api/admin/auth/session');
}

export function logoutAdmin(): Promise<void> {
  return apiFetch<void>('/api/admin/auth/logout', { method: 'POST' });
}
