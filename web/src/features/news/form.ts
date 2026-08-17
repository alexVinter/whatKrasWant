export interface NewsFormValues {
  title: string;
  body: string;
  publishDate: string;
}

export const EMPTY_NEWS_FORM: NewsFormValues = {
  title: '',
  body: '',
  publishDate: '',
};

export function dateToInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

export function formatNewsDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function validateNewsForm(
  values: NewsFormValues,
  requirePublishDate: boolean,
): string | null {
  if (!values.title.trim()) {
    return 'Укажите название новости.';
  }
  if (!values.body.trim()) {
    return 'Укажите текст новости.';
  }
  if (requirePublishDate && !values.publishDate) {
    return 'Для публикации укажите дату публикации.';
  }
  return null;
}
