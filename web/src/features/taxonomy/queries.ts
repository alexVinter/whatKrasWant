import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCategory,
  createDistrict,
  getAdminCategories,
  getAdminDistricts,
  updateCategory,
  updateDistrict,
} from './api';
import type { TaxonomyInput } from './types';

export const CATEGORIES_QUERY_KEY = ['admin', 'categories'] as const;
export const DISTRICTS_QUERY_KEY = ['admin', 'districts'] as const;

export function useAdminCategories() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getAdminCategories,
  });
}

export function useAdminDistricts() {
  return useQuery({
    queryKey: DISTRICTS_QUERY_KEY,
    queryFn: getAdminDistricts,
  });
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

  const create = useMutation({
    mutationFn: (input: TaxonomyInput) => createCategory(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaxonomyInput> }) =>
      updateCategory(id, input),
    onSuccess: invalidate,
  });

  return { create, update };
}

export function useDistrictMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: DISTRICTS_QUERY_KEY });

  const create = useMutation({
    mutationFn: (input: TaxonomyInput) => createDistrict(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaxonomyInput> }) =>
      updateDistrict(id, input),
    onSuccess: invalidate,
  });

  return { create, update };
}
