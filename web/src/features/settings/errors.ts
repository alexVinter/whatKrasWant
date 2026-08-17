import { ApiError } from '../../shared/api/client';

export function humanizeSettingsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Проверьте правильность заполнения полей.';
    }
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
  }
  return 'Не удалось сохранить настройки. Попробуйте ещё раз.';
}
