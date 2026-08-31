import { apiFetch } from '../../shared/api/client';
import type { PublicSessionState, VkLoginResponse } from './types';

export function loginWithVkAccessToken(
  accessToken: string,
): Promise<VkLoginResponse> {
  return apiFetch<VkLoginResponse>('/api/public/auth/vk', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

export function getPublicSession(): Promise<PublicSessionState> {
  return apiFetch<PublicSessionState>('/api/public/auth/session');
}

export function logoutPublic(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>('/api/public/auth/logout', {
    method: 'POST',
  });
}
