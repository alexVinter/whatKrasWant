import { apiFetch } from '../../shared/api/client';
import type { PublicIdeaTopic, PublicSubmissionResult } from './types';

export function getPublicIdeaTopics(): Promise<PublicIdeaTopic[]> {
  return apiFetch<PublicIdeaTopic[]>('/api/public/idea-topics');
}

export function submitPublicIdea(formData: FormData): Promise<PublicSubmissionResult> {
  return apiFetch<PublicSubmissionResult>('/api/public/ideas', {
    method: 'POST',
    body: formData,
  });
}
