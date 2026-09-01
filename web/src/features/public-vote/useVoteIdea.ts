import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePublicConfig } from '../public-config/queries';
import { useRequirePublicAuthAction } from '../public-auth/useRequirePublicAuthAction';
import {
  PUBLIC_IDEAS_KEY,
  publicIdeaDetailKey,
} from '../public-ideas/queries';
import { castVote } from './api';

export function useVoteIdea(slug: string) {
  const configQuery = usePublicConfig();
  const queryClient = useQueryClient();
  const { runWithAuth, pending: authPending } = useRequirePublicAuthAction();
  const [localHasVoted, setLocalHasVoted] = useState(false);

  const votingEnabled = configQuery.data?.features?.VOTING ?? false;

  const voteMutation = useMutation({
    mutationFn: () => castVote(slug),
    onSuccess: (result) => {
      setLocalHasVoted(true);
      queryClient.setQueryData(publicIdeaDetailKey(slug), (prev: unknown) => {
        if (!prev || typeof prev !== 'object') {
          return prev;
        }
        return {
          ...prev,
          voteCount: result.voteCount,
          hasVoted: true,
        };
      });
      void queryClient.invalidateQueries({ queryKey: PUBLIC_IDEAS_KEY });
    },
  });

  const support = useCallback(async () => {
    if (!votingEnabled || voteMutation.isPending || authPending) {
      return;
    }
    await runWithAuth(async () => {
      try {
        await voteMutation.mutateAsync();
      } catch {
        // Conflict / network — detail query may refresh hasVoted state.
      }
    });
  }, [
    votingEnabled,
    voteMutation,
    authPending,
    runWithAuth,
  ]);

  return {
    support,
    votingEnabled,
    pending: authPending || voteMutation.isPending,
    voteError: voteMutation.isError,
    localHasVoted,
  };
}
