import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from './api';
import type { AuditListQuery } from './types';

export const AUDIT_KEY = ['audit'] as const;

export const auditListKey = (query: AuditListQuery = {}) =>
  [...AUDIT_KEY, query] as const;

export function useAuditLog(query: AuditListQuery = {}) {
  return useQuery({
    queryKey: auditListKey(query),
    queryFn: () => getAuditLog(query),
  });
}
