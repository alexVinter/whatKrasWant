import { ApiError } from '../../shared/api/client';

export function humanizeNewsError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Проверьте правильность заполнения полей.';
    }
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
    if (error.status === 404) {
      return 'Новость не найдена. Обновите страницу.';
    }
  }
  return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
}

export function humanizeNewsImageError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
    if (error.status === 404) {
      return 'Новость не найдена. Обновите страницу.';
    }
  }
  return 'Не удалось загрузить изображение.';
}
