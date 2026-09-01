import { apiFetch } from '../../shared/api/client';

export interface CastVoteResponse {
  voteId: string;
  voteCount: number;
  hasVoted: true;
}

export function castVote(slug: string): Promise<CastVoteResponse> {
  return apiFetch<CastVoteResponse>(
    `/api/public/ideas/${encodeURIComponent(slug)}/vote`,
    { method: 'POST' },
  );
}
