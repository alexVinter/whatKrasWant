import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUDIT_KEY } from '../audit/queries';
import { getAdminSettings, updateAdminSettings } from './api';
import type { AdminSettings } from './types';

export const ADMIN_SETTINGS_QUERY_KEY = ['admin-settings'] as const;
export const PUBLIC_CONFIG_QUERY_KEY = ['public', 'config'] as const;

export function useAdminSettings() {
  return useQuery({
    queryKey: ADMIN_SETTINGS_QUERY_KEY,
    queryFn: getAdminSettings,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdminSettings) => updateAdminSettings(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(ADMIN_SETTINGS_QUERY_KEY, saved);
      void queryClient.invalidateQueries({ queryKey: ADMIN_SETTINGS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PUBLIC_CONFIG_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}
