import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PUBLIC_IDEAS_KEY } from '../public-ideas/queries';
import { getPublicSession, loginWithVkAccessToken, logoutPublic } from './api';
import { obtainVkAccessToken } from './vkSdk';
import type { PublicSessionState } from './types';

export const PUBLIC_SESSION_QUERY_KEY = ['public', 'session'] as const;

export function usePublicSession() {
  return useQuery({
    queryKey: PUBLIC_SESSION_QUERY_KEY,
    queryFn: getPublicSession,
    retry: false,
    staleTime: 30_000,
  });
}

export function usePublicAuthActions() {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await obtainVkAccessToken();
      return loginWithVkAccessToken(accessToken);
    },
    onSuccess: (response) => {
      const nextSession: PublicSessionState = {
        authenticated: true,
        user: response.user,
      };
      queryClient.setQueryData(PUBLIC_SESSION_QUERY_KEY, nextSession);
      void queryClient.invalidateQueries({ queryKey: PUBLIC_IDEAS_KEY });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutPublic,
    onSuccess: () => {
      queryClient.setQueryData(PUBLIC_SESSION_QUERY_KEY, {
        authenticated: false,
      });
    },
  });

  return {
    loginMutation,
    logoutMutation,
  };
}
