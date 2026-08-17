import type {
  Category,
  District,
  IdeaStatus,
  NewsStatus,
  TerritoryType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  AUDIT_ENTITIES,
  SETTINGS_OBJECT_LABEL,
  type AuditEntityType,
} from './audit.constants';

export interface IdeaAuditFields {
  id: string;
  title: string;
  sourceType: string;
  expertName: string | null;
  expertOrg: string | null;
  categoryId: string | null;
  territoryType: TerritoryType;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: IdeaStatus;
  isTop20: boolean;
  publishedAt: Date | null;
}

export function ideaAuditSnapshot(
  idea: IdeaAuditFields,
  districtIds: string[],
  hasImage: boolean,
): Prisma.InputJsonObject {
  return {
    id: idea.id,
    title: idea.title,
    sourceType: idea.sourceType,
    expertName: idea.expertName,
    expertOrg: idea.expertOrg,
    categoryId: idea.categoryId,
    territoryType: idea.territoryType,
    districtIds,
    address: idea.address,
    latitude: idea.latitude,
    longitude: idea.longitude,
    status: idea.status,
    isTop20: idea.isTop20,
    publishedAt: idea.publishedAt ? idea.publishedAt.toISOString() : null,
    hasImage,
  };
}

export function categoryAuditSnapshot(
  category: Pick<Category, 'id' | 'name' | 'slug' | 'sortOrder' | 'isActive'>,
): Prisma.InputJsonObject {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

export function districtAuditSnapshot(
  district: Pick<District, 'id' | 'name' | 'sortOrder' | 'isActive'>,
): Prisma.InputJsonObject {
  return {
    id: district.id,
    name: district.name,
    sortOrder: district.sortOrder,
    isActive: district.isActive,
  };
}

export interface NewsAuditFields {
  id: string;
  title: string;
  slug: string;
  publishDate: Date | null;
  status: NewsStatus;
}

export function newsAuditSnapshot(
  news: NewsAuditFields,
  hasImage: boolean,
): Prisma.InputJsonObject {
  return {
    id: news.id,
    title: news.title,
    slug: news.slug,
    publishDate: news.publishDate ? news.publishDate.toISOString() : null,
    status: news.status,
    hasImage,
  };
}

export function objectLabelFromSnapshot(
  entityType: AuditEntityType | string,
  snapshot: unknown,
): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return '';
  }
  const record = snapshot as Record<string, unknown>;
  if (entityType === AUDIT_ENTITIES.IDEA) {
    return typeof record.title === 'string' ? record.title : '';
  }
  if (
    entityType === AUDIT_ENTITIES.CATEGORY ||
    entityType === AUDIT_ENTITIES.DISTRICT
  ) {
    return typeof record.name === 'string' ? record.name : '';
  }
  if (entityType === AUDIT_ENTITIES.SETTINGS) {
    return SETTINGS_OBJECT_LABEL;
  }
  if (entityType === AUDIT_ENTITIES.NEWS) {
    return typeof record.title === 'string' ? record.title : '';
  }
  return '';
}
