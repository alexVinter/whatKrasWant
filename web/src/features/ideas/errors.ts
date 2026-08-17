import { ApiError } from '../../shared/api/client';

/** Maps API failures for image upload/delete. */
export function humanizeImageError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
    if (error.status === 404) {
      return 'Инициатива не найдена. Обновите страницу.';
    }
  }
  return 'Не удалось загрузить изображение.';
}
export function humanizeIdeaError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Проверьте правильность заполнения полей.';
    }
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
    if (error.status === 404) {
      return 'Инициатива не найдена. Обновите страницу.';
    }
    if (error.status === 409) {
      return 'Конфликт данных. Обновите страницу и попробуйте снова.';
    }
  }
  return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
}
