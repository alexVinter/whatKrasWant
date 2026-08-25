import type {
  CreateIdeaInput,
  IdeaDetail,
  TerritoryType,
  UpdateIdeaInput,
} from './types';

export interface IdeaFormValues {
  expertName: string;
  expertOrg: string;
  title: string;
  description: string;
  categoryId: string;
  topicId: string;
  territoryType: TerritoryType;
  districtIds: string[];
  hasSpecificPlace: boolean;
  address: string;
  latitude: string;
  longitude: string;
}

export const EMPTY_IDEA_FORM: IdeaFormValues = {
  expertName: '',
  expertOrg: '',
  title: '',
  description: '',
  categoryId: '',
  topicId: '',
  territoryType: 'CITYWIDE',
  districtIds: [],
  hasSpecificPlace: false,
  address: '',
  latitude: '',
  longitude: '',
};

export function ideaToForm(idea: IdeaDetail): IdeaFormValues {
  return {
    expertName: idea.expertName ?? '',
    expertOrg: idea.expertOrg ?? '',
    title: idea.title,
    description: idea.description,
    categoryId: idea.categoryId ?? '',
    topicId: idea.topicId ?? '',
    territoryType: idea.territoryType,
    districtIds: idea.districtIds,
    hasSpecificPlace: idea.hasSpecificPlace,
    address: idea.address ?? '',
    latitude: idea.latitude !== null ? String(idea.latitude) : '',
    longitude: idea.longitude !== null ? String(idea.longitude) : '',
  };
}

function parseCoord(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function toCreateInput(
  values: IdeaFormValues,
  action: 'DRAFT' | 'PUBLISH',
): CreateIdeaInput {
  return {
    action,
    expertName: values.expertName.trim() || undefined,
    expertOrg: values.expertOrg.trim() || undefined,
    title: values.title.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId || null,
    topicId: values.topicId || null,
    territoryType: values.territoryType,
    districtIds:
      values.territoryType === 'DISTRICTS' ? values.districtIds : undefined,
    hasSpecificPlace: values.hasSpecificPlace,
    address: values.hasSpecificPlace ? values.address.trim() : undefined,
    latitude: values.hasSpecificPlace ? parseCoord(values.latitude) : undefined,
    longitude: values.hasSpecificPlace
      ? parseCoord(values.longitude)
      : undefined,
  };
}

export function toUpdateInput(
  values: IdeaFormValues,
  reason: string,
): UpdateIdeaInput {
  return {
    expertName: values.expertName.trim(),
    expertOrg: values.expertOrg.trim(),
    title: values.title.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId || null,
    topicId: values.topicId || null,
    territoryType: values.territoryType,
    districtIds:
      values.territoryType === 'DISTRICTS' ? values.districtIds : undefined,
    hasSpecificPlace: values.hasSpecificPlace,
    address: values.hasSpecificPlace ? values.address.trim() : undefined,
    latitude: values.hasSpecificPlace ? parseCoord(values.latitude) : undefined,
    longitude: values.hasSpecificPlace
      ? parseCoord(values.longitude)
      : undefined,
    reason: reason.trim() || undefined,
  };
}

/**
 * Client-side pre-validation mirroring the backend rules. Returns the first
 * human-readable error, or null when the form is valid for the given action.
 */
export function validateIdeaForm(
  values: IdeaFormValues,
  forPublish: boolean,
): string | null {
  const title = values.title.trim();
  if (title.length < 10 || title.length > 150) {
    return 'Название должно быть от 10 до 150 символов.';
  }
  const description = values.description.trim();
  if (description.length < 50 || description.length > 3000) {
    return 'Описание должно быть от 50 до 3000 символов.';
  }
  if (values.territoryType === 'DISTRICTS' && values.districtIds.length === 0) {
    return 'Выберите хотя бы один район или «Весь город».';
  }
  if (values.hasSpecificPlace) {
    if (values.address.trim().length === 0) {
      return 'Укажите адрес для конкретного места.';
    }
    if (
      parseCoord(values.latitude) === undefined ||
      parseCoord(values.longitude) === undefined
    ) {
      return 'Укажите координаты геометки (широта и долгота).';
    }
  }
  if (forPublish && !values.categoryId) {
    return 'Для публикации необходимо выбрать категорию.';
  }
  return null;
}
