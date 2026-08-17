import type { IdeaStatus, TerritoryType } from './types';

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  DRAFT: 'Черновик',
  MODERATION: 'На модерации',
  PUBLISHED: 'Опубликована',
  ARCHIVED: 'Архив',
};

export const STATUS_FILTER_OPTIONS: { value: IdeaStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'MODERATION', label: 'На модерации' },
  { value: 'PUBLISHED', label: 'Опубликована' },
  { value: 'ARCHIVED', label: 'Архив' },
];

export function territoryLabel(item: {
  territoryType: TerritoryType;
  districts: { name: string }[];
}): string {
  if (item.territoryType === 'CITYWIDE') {
    return 'Весь город';
  }
  if (item.districts.length === 0) {
    return '—';
  }
  return item.districts.map((d) => `${d.name} район`).join(', ');
}
