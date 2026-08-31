import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePublicConfig } from '../public-config/queries';
import {
  PUBLIC_SESSION_QUERY_KEY,
  usePublicAuthActions,
  usePublicSession,
} from '../public-auth/usePublicAuth';
import { getPublicSession } from '../public-auth/api';

export function useStartSubmissionFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = usePublicSession();
  const configQuery = usePublicConfig();
  const { loginMutation } = usePublicAuthActions();
  const [flowPending, setFlowPending] = useState(false);
  const inFlightRef = useRef(false);

  const submissionEnabled =
    configQuery.data?.features?.PUBLIC_SUBMISSION ?? false;

  const startSubmission = useCallback(async () => {
    if (!submissionEnabled || inFlightRef.current) {
      return;
    }

    if (sessionQuery.data?.authenticated) {
      navigate('/submit');
      return;
    }

    inFlightRef.current = true;
    setFlowPending(true);
    try {
      await loginMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: PUBLIC_SESSION_QUERY_KEY });
      const session = await getPublicSession();
      if (session.authenticated) {
        navigate('/submit');
      }
    } catch {
      // VK cancelled, network error, etc. — stay on current page.
    } finally {
      inFlightRef.current = false;
      setFlowPending(false);
    }
  }, [
    submissionEnabled,
    sessionQuery.data?.authenticated,
    navigate,
    loginMutation,
    queryClient,
  ]);

  return {
    startSubmission,
    submissionEnabled,
    pending: flowPending || loginMutation.isPending,
    sessionLoading: sessionQuery.isLoading,
  };
}
