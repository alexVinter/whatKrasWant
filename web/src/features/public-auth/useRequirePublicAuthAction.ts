import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PUBLIC_SESSION_QUERY_KEY,
  usePublicAuthActions,
  usePublicSession,
} from '../public-auth/usePublicAuth';
import { getPublicSession } from '../public-auth/api';

export function useRequirePublicAuthAction() {
  const queryClient = useQueryClient();
  const sessionQuery = usePublicSession();
  const { loginMutation } = usePublicAuthActions();
  const [flowPending, setFlowPending] = useState(false);
  const inFlightRef = useRef(false);

  const runWithAuth = useCallback(
    async (action: () => void | Promise<void>) => {
      if (inFlightRef.current) {
        return false;
      }

      if (sessionQuery.data?.authenticated) {
        await action();
        return true;
      }

      inFlightRef.current = true;
      setFlowPending(true);
      try {
        await loginMutation.mutateAsync();
        await queryClient.invalidateQueries({
          queryKey: PUBLIC_SESSION_QUERY_KEY,
        });
        const session = await getPublicSession();
        if (session.authenticated) {
          await action();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        inFlightRef.current = false;
        setFlowPending(false);
      }
    },
    [sessionQuery.data?.authenticated, loginMutation, queryClient],
  );

  return {
    runWithAuth,
    pending: flowPending || loginMutation.isPending,
    sessionLoading: sessionQuery.isLoading,
    authenticated: sessionQuery.data?.authenticated ?? false,
  };
}
