export const AUDIT_ACTION_LABELS: Record<string, string> = {
  IDEA_CREATED: 'Создана инициатива',
  IDEA_UPDATED: 'Изменена инициатива',
  IDEA_PUBLISHED: 'Опубликована инициатива',
  IDEA_UNPUBLISHED: 'Инициатива снята с публикации',
  IDEA_ARCHIVED: 'Архивирована инициатива',
  IDEA_RESTORED: 'Восстановлена инициатива',
  IDEA_IMAGE_ADDED: 'Добавлено изображение инициативы',
  IDEA_IMAGE_REPLACED: 'Заменено изображение инициативы',
  IDEA_IMAGE_REMOVED: 'Удалено изображение инициативы',
  CATEGORY_CREATED: 'Создана категория',
  CATEGORY_UPDATED: 'Изменена категория',
  DISTRICT_CREATED: 'Создан район',
  DISTRICT_UPDATED: 'Изменён район',
  SETTINGS_UPDATED: 'Изменены настройки',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? 'Действие';
}

export function formatAuditDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
