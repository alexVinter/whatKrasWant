import { useQuery } from '@tanstack/react-query';
import { getAdminStatistics } from './api';

export const ADMIN_STATISTICS_QUERY_KEY = ['admin-statistics'] as const;

export function useAdminStatistics() {
  return useQuery({
    queryKey: ADMIN_STATISTICS_QUERY_KEY,
    queryFn: getAdminStatistics,
  });
}
