import { IdeaSourceType, IdeaStatus } from '@prisma/client';

export const CITYWIDE_TERRITORY_ID = 'CITYWIDE';
export const CITYWIDE_TERRITORY_NAME = 'Весь город';

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  DRAFT: 'Черновик',
  MODERATION: 'На модерации',
  PUBLISHED: 'Опубликована',
  ARCHIVED: 'Архив',
};

export const SOURCE_LABELS: Record<IdeaSourceType, string> = {
  EXPERT: 'Эксперт',
  RESIDENT: 'Житель',
};

export const XLSX_SHEETS = {
  INITIATIVES: 'Инициативы',
  AUTHORS: 'Авторы и источники',
  VOTES: 'Голоса',
  STATISTICS: 'Статистика',
  TOP20: 'Топ-20',
} as const;

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const EXCEL_DATE_FORMAT = 'dd.mm.yyyy hh:mm';

export function yesNo(value: boolean): string {
  return value ? 'Да' : 'Нет';
}
