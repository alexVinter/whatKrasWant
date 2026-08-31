import { isPointInKrasnoyarsk } from '../../shared/geo/is-point-in-krasnoyarsk';
import { KRASNOYARSK_GEO_ERROR } from '../../shared/geo/krasnoyarsk.constants';
import { validateImageFile } from '../ideas/image';
import type { PublicSubmissionFormValues } from './types';

function parseCoord(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function validatePublicSubmissionForm(
  values: PublicSubmissionFormValues,
  imageFile: File | null,
): string | null {
  if (!values.topicId) {
    return 'Выберите тему идеи.';
  }

  const title = values.title.trim();
  if (title.length < 10 || title.length > 150) {
    return 'Название должно быть от 10 до 150 символов.';
  }

  const description = values.description.trim();
  if (description.length < 50 || description.length > 3000) {
    return 'Описание должно быть от 50 до 3000 символов.';
  }

  if (values.address.trim().length === 0) {
    return 'Укажите адрес для конкретного места.';
  }

  const lat = parseCoord(values.latitude);
  const lng = parseCoord(values.longitude);
  if (lat === undefined || lng === undefined) {
    return 'Укажите геометку на карте.';
  }
  if (!isPointInKrasnoyarsk(lat, lng)) {
    return KRASNOYARSK_GEO_ERROR;
  }

  if (imageFile) {
    const imageError = validateImageFile(imageFile);
    if (imageError) {
      return imageError;
    }
  }

  return null;
}

export function buildPublicSubmissionFormData(
  values: PublicSubmissionFormValues,
  imageFile: File | null,
): FormData {
  const lat = parseCoord(values.latitude);
  const lng = parseCoord(values.longitude);
  const formData = new FormData();
  formData.append('topicId', values.topicId);
  formData.append('title', values.title.trim());
  formData.append('description', values.description.trim());
  formData.append('address', values.address.trim());
  formData.append('latitude', String(lat));
  formData.append('longitude', String(lng));
  if (imageFile) {
    formData.append('image', imageFile);
  }
  return formData;
}
