import { useQuery } from '@tanstack/react-query';
import { getAdminIdeaTopics } from './api';

export const IDEA_TOPICS_QUERY_KEY = ['admin', 'idea-topics'] as const;

export function useAdminIdeaTopics() {
  return useQuery({
    queryKey: IDEA_TOPICS_QUERY_KEY,
    queryFn: getAdminIdeaTopics,
  });
}
