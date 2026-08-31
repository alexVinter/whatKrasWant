import { ApiError } from '../../shared/api/client';

export function humanizeSubmissionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Проверьте правильность заполнения полей.';
    }
    if (error.status === 401) {
      return 'Сессия истекла. Войдите через VK ID и попробуйте снова.';
    }
    if (error.status === 403) {
      return 'Отправка инициатив недоступна для вашего аккаунта.';
    }
    if (error.status === 404) {
      return 'Подача инициатив сейчас недоступна.';
    }
  }
  return 'Не удалось отправить инициативу. Попробуйте ещё раз.';
}

export function humanizeVkFlowError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return 'Не удалось войти через VK ID. Попробуйте ещё раз.';
  }
  return 'Не удалось войти через VK ID. Попробуйте ещё раз.';
}
