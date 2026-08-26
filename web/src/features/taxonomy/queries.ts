import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDistrict,
  getAdminDistricts,
  updateDistrict,
} from './api';
import type { TaxonomyInput } from './types';

export const DISTRICTS_QUERY_KEY = ['admin', 'districts'] as const;

export function useAdminDistricts() {
  return useQuery({
    queryKey: DISTRICTS_QUERY_KEY,
    queryFn: getAdminDistricts,
  });
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
