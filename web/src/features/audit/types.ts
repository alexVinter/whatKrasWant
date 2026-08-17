export type AuditAction =
  | 'IDEA_CREATED'
  | 'IDEA_UPDATED'
  | 'IDEA_PUBLISHED'
  | 'IDEA_UNPUBLISHED'
  | 'IDEA_ARCHIVED'
  | 'IDEA_RESTORED'
  | 'IDEA_IMAGE_ADDED'
  | 'IDEA_IMAGE_REPLACED'
  | 'IDEA_IMAGE_REMOVED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'DISTRICT_CREATED'
  | 'DISTRICT_UPDATED';

export type AuditEntityType = 'IDEA' | 'CATEGORY' | 'DISTRICT';

export interface AuditActor {
  id: string;
  login: string;
}

export interface AuditItem {
  id: string;
  createdAt: string;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId: string | null;
  actor: AuditActor | null;
  objectLabel: string;
}

export interface AuditListResponse {
  items: AuditItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuditListQuery {
  page?: number;
  pageSize?: number;
}
