import { normalizePersonName } from './normalize-person-name.util';

describe('normalizePersonName', () => {
  it('transliterates Latin first names to Cyrillic', () => {
    expect(normalizePersonName('Alexey')).toBe('Алексей');
  });

  it('transliterates Latin last names to Cyrillic', () => {
    expect(normalizePersonName('Vinter')).toBe('Винтер');
  });

  it('keeps Cyrillic names unchanged', () => {
    expect(normalizePersonName('Алексей')).toBe('Алексей');
  });

  it('preserves spaces between name parts', () => {
    expect(normalizePersonName('Alexey Vinter')).toBe('Алексей Винтер');
  });

  it('keeps mixed-script names unchanged', () => {
    expect(normalizePersonName('Alexey Иванов')).toBe('Alexey Иванов');
  });
});
