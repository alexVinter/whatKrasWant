import { ApiError } from '../../shared/api/client';

/** Maps API failures to short, human-readable Russian messages (no raw backend text). */
export function humanizeTaxonomyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'Элемент с таким названием уже существует.';
    }
    if (error.status === 400) {
      return 'Проверьте правильность заполнения полей.';
    }
    if (error.status === 401) {
      return 'Сессия истекла. Войдите заново.';
    }
    if (error.status === 404) {
      return 'Элемент не найден. Обновите страницу.';
    }
  }
  return 'Не удалось сохранить изменения. Попробуйте ещё раз.';
}
