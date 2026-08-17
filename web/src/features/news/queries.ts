import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNews,
  deleteNewsImage,
  getAdminNews,
  getAdminNewsItem,
  getPublicNews,
  getPublicNewsDetail,
  publishNews,
  unpublishNews,
  updateNews,
  uploadNewsImage,
} from './api';
import type { CreateNewsInput, UpdateNewsInput } from './types';

export const ADMIN_NEWS_KEY = ['admin', 'news'] as const;
export const adminNewsDetailKey = (id: string) =>
  [...ADMIN_NEWS_KEY, 'detail', id] as const;
export const PUBLIC_NEWS_KEY = ['public', 'news'] as const;
export const publicNewsDetailKey = (slug: string) =>
  [...PUBLIC_NEWS_KEY, 'detail', slug] as const;

export function useAdminNews() {
  return useQuery({
    queryKey: ADMIN_NEWS_KEY,
    queryFn: getAdminNews,
  });
}

export function useAdminNewsItem(id: string | undefined) {
  return useQuery({
    queryKey: adminNewsDetailKey(id ?? ''),
    queryFn: () => getAdminNewsItem(id!),
    enabled: Boolean(id),
  });
}

export function useCreateNews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNewsInput) => createNews(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_NEWS_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLIC_NEWS_KEY });
    },
  });
}

export function useNewsMutations(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ADMIN_NEWS_KEY });
    queryClient.invalidateQueries({ queryKey: PUBLIC_NEWS_KEY });
  };

  return {
    save: useMutation({
      mutationFn: (input: UpdateNewsInput) => updateNews(id, input),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: () => publishNews(id),
      onSuccess: invalidate,
    }),
    unpublish: useMutation({
      mutationFn: () => unpublishNews(id),
      onSuccess: invalidate,
    }),
    uploadImage: useMutation({
      mutationFn: (file: File) => uploadNewsImage(id, file),
      onSuccess: invalidate,
    }),
    deleteImage: useMutation({
      mutationFn: () => deleteNewsImage(id),
      onSuccess: invalidate,
    }),
  };
}

export function usePublicNews() {
  return useQuery({
    queryKey: PUBLIC_NEWS_KEY,
    queryFn: getPublicNews,
  });
}

export function usePublicNewsDetail(slug: string) {
  return useQuery({
    queryKey: publicNewsDetailKey(slug),
    queryFn: () => getPublicNewsDetail(slug),
  });
}
