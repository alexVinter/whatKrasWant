import { useQuery } from '@tanstack/react-query';
import { getAdminSession } from './api';

export const ADMIN_SESSION_QUERY_KEY = ['admin', 'session'] as const;

export function useAdminSession() {
  return useQuery({
    queryKey: ADMIN_SESSION_QUERY_KEY,
    queryFn: getAdminSession,
    retry: false,
    staleTime: 30_000,
  });
}
