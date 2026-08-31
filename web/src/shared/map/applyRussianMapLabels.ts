import type { ExpressionSpecification, Map } from 'maplibre-gl';

/**
 * OpenMapTiles multilingual name priority for Russian UI.
 * Prefer explicit Russian tag, then local name, then remaining script fallbacks.
 */
export const RUSSIAN_MAP_NAME_EXPRESSION: ExpressionSpecification = [
  'coalesce',
  ['get', 'name:ru'],
  ['get', 'name'],
  ['get', 'name:nonlatin'],
  ['get', 'name:latin'],
  ['get', 'name_en'],
];

const TRANSLIT_NAME_PATTERN = /name:latin|name:nonlatin|name_en|name:en/;

function expressionUsesTranslitNames(textField: unknown): boolean {
  return TRANSLIT_NAME_PATTERN.test(JSON.stringify(textField));
}

function expressionUsesRoadRefOnly(textField: unknown): boolean {
  const serialized = JSON.stringify(textField);
  return serialized.includes('"ref"') && !expressionUsesTranslitNames(textField);
}

/**
 * Returns a Russian-priority text-field expression when the layer uses
 * OpenMapTiles transliteration fields. Returns null when the layer should
 * stay unchanged (road shields, static labels, unknown expressions).
 */
export function resolveRussianMapLabelExpression(textField: unknown): ExpressionSpecification | null {
  if (textField === undefined || textField === null) {
    return null;
  }

  if (typeof textField === 'string') {
    return null;
  }

  if (expressionUsesRoadRefOnly(textField)) {
    return null;
  }

  if (!expressionUsesTranslitNames(textField)) {
    return null;
  }

  return RUSSIAN_MAP_NAME_EXPRESSION;
}

/**
 * Replaces OpenFreeMap/OpenMapTiles transliteration label expressions with
 * Russian-priority names on all relevant symbol layers.
 */
export function applyRussianMapLabels(map: Map): string[] {
  const style = map.getStyle();
  if (!style?.layers) {
    return [];
  }

  const changedLayerIds: string[] = [];

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') {
      continue;
    }

    const layout = layer.layout as { 'text-field'?: unknown } | undefined;
    const textField = layout?.['text-field'];
    if (textField === undefined) {
      continue;
    }

    const nextExpression = resolveRussianMapLabelExpression(textField);
    if (!nextExpression) {
      continue;
    }

    map.setLayoutProperty(layer.id, 'text-field', nextExpression);
    changedLayerIds.push(layer.id);
  }

  return changedLayerIds;
}
