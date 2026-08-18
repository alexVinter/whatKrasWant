import { useQuery } from '@tanstack/react-query';
import { getPublicConfig } from '../taxonomy/api';

export const PUBLIC_CONFIG_KEY = ['public-config'] as const;

export function usePublicConfig() {
  return useQuery({
    queryKey: PUBLIC_CONFIG_KEY,
    queryFn: getPublicConfig,
  });
}
