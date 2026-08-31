import { describe, expect, it, vi } from 'vitest';
import {
  RUSSIAN_MAP_NAME_EXPRESSION,
  applyRussianMapLabels,
  resolveRussianMapLabelExpression,
} from './applyRussianMapLabels';

const OPENFREEMAP_NAME_EXPRESSION = [
  'case',
  ['has', 'name:nonlatin'],
  ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']],
  ['coalesce', ['get', 'name_en'], ['get', 'name']],
];

describe('resolveRussianMapLabelExpression', () => {
  it('prefers name:ru in the generated expression', () => {
    expect(resolveRussianMapLabelExpression(OPENFREEMAP_NAME_EXPRESSION)).toEqual(
      RUSSIAN_MAP_NAME_EXPRESSION,
    );
    expect(RUSSIAN_MAP_NAME_EXPRESSION[1]).toEqual(['get', 'name:ru']);
    expect(RUSSIAN_MAP_NAME_EXPRESSION[2]).toEqual(['get', 'name']);
  });

  it('falls back through name, nonlatin, latin and name_en', () => {
    expect(RUSSIAN_MAP_NAME_EXPRESSION).toEqual([
      'coalesce',
      ['get', 'name:ru'],
      ['get', 'name'],
      ['get', 'name:nonlatin'],
      ['get', 'name:latin'],
      ['get', 'name_en'],
    ]);
  });

  it('does not change road shield ref labels', () => {
    expect(resolveRussianMapLabelExpression(['to-string', ['get', 'ref']])).toBeNull();
  });

  it('does not change layers without text-field-like expressions', () => {
    expect(resolveRussianMapLabelExpression(undefined)).toBeNull();
    expect(resolveRussianMapLabelExpression('Static label')).toBeNull();
    expect(resolveRussianMapLabelExpression(['get', 'housenumber'])).toBeNull();
  });
});

describe('applyRussianMapLabels', () => {
  it('updates only symbol layers with transliteration expressions', () => {
    const setLayoutProperty = vi.fn();
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'background', type: 'background' },
          {
            id: 'label_city',
            type: 'symbol',
            layout: { 'text-field': OPENFREEMAP_NAME_EXPRESSION },
          },
          {
            id: 'highway-shield-non-us',
            type: 'symbol',
            layout: { 'text-field': ['to-string', ['get', 'ref']] },
          },
          {
            id: 'housenumber',
            type: 'symbol',
            layout: { 'text-field': ['get', 'housenumber'] },
          },
        ],
      }),
      setLayoutProperty,
    };

    const changed = applyRussianMapLabels(map as never);

    expect(changed).toEqual(['label_city']);
    expect(setLayoutProperty).toHaveBeenCalledTimes(1);
    expect(setLayoutProperty).toHaveBeenCalledWith(
      'label_city',
      'text-field',
      RUSSIAN_MAP_NAME_EXPRESSION,
    );
  });
});
