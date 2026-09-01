import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicConfig } from '../public-config/queries';
import { useRequirePublicAuthAction } from '../public-auth/useRequirePublicAuthAction';

export function useStartSubmissionFlow() {
  const navigate = useNavigate();
  const configQuery = usePublicConfig();
  const { runWithAuth, pending, sessionLoading } = useRequirePublicAuthAction();

  const submissionEnabled =
    configQuery.data?.features?.PUBLIC_SUBMISSION ?? false;

  const startSubmission = useCallback(async () => {
    if (!submissionEnabled) {
      return;
    }
    await runWithAuth(() => {
      navigate('/submit');
    });
  }, [submissionEnabled, runWithAuth, navigate]);

  return {
    startSubmission,
    submissionEnabled,
    pending,
    sessionLoading,
  };
}
