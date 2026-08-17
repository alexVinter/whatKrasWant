import { describe, expect, it } from 'vitest';
import { resolveImagePreview, validateImageFile } from './image';

describe('validateImageFile', () => {
  it('accepts JPEG and PNG', () => {
    expect(
      validateImageFile(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })),
    ).toBeNull();
    expect(
      validateImageFile(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })),
    ).toBeNull();
  });

  it('rejects GIF and oversized files', () => {
    expect(
      validateImageFile(new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' })),
    ).toBe('Допустимы изображения JPG и PNG.');
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.jpg', {
      type: 'image/jpeg',
    });
    expect(validateImageFile(big)).toBe('Максимальный размер файла — 10 МБ.');
  });

  it('prefers the local object URL over the saved server image', () => {
    expect(
      resolveImagePreview('blob:new', '/api/admin/ideas/i1/image/optimized?v=old'),
    ).toBe('blob:new');
    expect(
      resolveImagePreview(null, '/api/admin/ideas/i1/image/optimized?v=old'),
    ).toBe('/api/admin/ideas/i1/image/optimized?v=old');
    expect(resolveImagePreview(null, null)).toBeNull();
  });
});
