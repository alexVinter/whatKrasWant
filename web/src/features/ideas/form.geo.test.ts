import { describe, expect, it } from 'vitest';
import { EMPTY_IDEA_FORM, validateIdeaForm } from './form';
import { KRASNOYARSK_GEO_ERROR } from '../../shared/geo/krasnoyarsk.constants';

const VALID_FORM = {
  ...EMPTY_IDEA_FORM,
  title: 'Инициатива по благоустройству набережной',
  description:
    'Подробное описание инициативы по благоустройству набережной города для проверки формы.',
  hasSpecificPlace: true,
  address: 'проспект Мира, 1',
  latitude: '56.0153',
  longitude: '92.8932',
};

describe('validateIdeaForm geo validation', () => {
  it('accepts coordinates inside Krasnoyarsk', () => {
    expect(validateIdeaForm(VALID_FORM)).toBeNull();
  });

  it('rejects coordinates outside Krasnoyarsk', () => {
    expect(
      validateIdeaForm({
        ...VALID_FORM,
        latitude: '55.7558',
        longitude: '37.6173',
      }),
    ).toBe(KRASNOYARSK_GEO_ERROR);
  });
});
