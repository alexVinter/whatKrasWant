import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveIdea,
  createIdea,
  getIdea,
  getIdeaRevisions,
  getIdeas,
  getIdeasSummary,
  publishIdea,
  restoreIdea,
  unpublishIdea,
  updateIdea,
} from './api';
import type {
  CreateIdeaInput,
  IdeaListFilters,
  UpdateIdeaInput,
} from './types';

export const IDEAS_KEY = ['admin', 'ideas'] as const;
export const ideasListKey = (filters: IdeaListFilters) =>
  [...IDEAS_KEY, 'list', filters] as const;
export const IDEAS_SUMMARY_KEY = [...IDEAS_KEY, 'summary'] as const;
export const ideaDetailKey = (id: string) => [...IDEAS_KEY, 'detail', id];
export const ideaRevisionsKey = (id: string) =>
  [...IDEAS_KEY, 'revisions', id];

export function useIdeas(filters: IdeaListFilters) {
  return useQuery({
    queryKey: ideasListKey(filters),
    queryFn: () => getIdeas(filters),
  });
}

export function useIdeasSummary() {
  return useQuery({
    queryKey: IDEAS_SUMMARY_KEY,
    queryFn: getIdeasSummary,
  });
}

export function useIdea(id: string) {
  return useQuery({
    queryKey: ideaDetailKey(id),
    queryFn: () => getIdea(id),
  });
}

export function useIdeaRevisions(id: string) {
  return useQuery({
    queryKey: ideaRevisionsKey(id),
    queryFn: () => getIdeaRevisions(id),
  });
}

export function useCreateIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIdeaInput) => createIdea(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IDEAS_KEY });
    },
  });
}

/** Edit-page mutations for a single initiative (save + lifecycle actions). */
export function useIdeaMutations(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: IDEAS_KEY });
  };

  const save = useMutation({
    mutationFn: (input: UpdateIdeaInput) => updateIdea(id, input),
    onSuccess: invalidate,
  });
  const publish = useMutation({
    mutationFn: () => publishIdea(id),
    onSuccess: invalidate,
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishIdea(id),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => archiveIdea(id),
    onSuccess: invalidate,
  });
  const restore = useMutation({
    mutationFn: () => restoreIdea(id),
    onSuccess: invalidate,
  });

  return { save, publish, unpublish, archive, restore };
}
