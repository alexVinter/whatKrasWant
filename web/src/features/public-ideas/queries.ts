import { useQuery } from '@tanstack/react-query';
import { getPublicIdeaDetail, getPublicIdeas, getPublicMapIdeas } from './api';

export const PUBLIC_IDEAS_KEY = ['public', 'ideas'] as const;
export const PUBLIC_MAP_IDEAS_KEY = ['public', 'map-ideas'] as const;
export const publicIdeaDetailKey = (slug: string) =>
  [...PUBLIC_IDEAS_KEY, 'detail', slug] as const;

export function usePublicIdeas(enabled = true) {
  return useQuery({
    queryKey: PUBLIC_IDEAS_KEY,
    queryFn: () => getPublicIdeas(1, 100),
    enabled,
  });
}

export function usePublicIdeaDetail(slug: string, enabled = true) {
  return useQuery({
    queryKey: publicIdeaDetailKey(slug),
    queryFn: () => getPublicIdeaDetail(slug),
    enabled: enabled && Boolean(slug),
    retry: false,
  });
}

export function usePublicMapIdeas(enabled = true) {
  return useQuery({
    queryKey: PUBLIC_MAP_IDEAS_KEY,
    queryFn: getPublicMapIdeas,
    enabled,
  });
}
