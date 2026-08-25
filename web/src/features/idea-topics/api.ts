import { apiFetch } from '../../shared/api/client';
import type { AdminIdeaTopic } from './types';

export function getAdminIdeaTopics(): Promise<AdminIdeaTopic[]> {
  return apiFetch<AdminIdeaTopic[]>('/api/admin/idea-topics');
}
