import { ApiError } from '../../shared/api/client';

export function humanizeStatisticsError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Сессия истекла. Войдите заново.';
  }
  return 'Не удалось загрузить статистику. Обновите страницу.';
}

export function humanizeExportError(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Сессия истекла. Войдите заново.';
  }
  return 'Не удалось сформировать XLSX. Попробуйте ещё раз.';
}
