export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';

/** Client-side pre-check. Backend still re-validates MIME and signature. */
export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase();
  if (type && type !== 'image/jpeg' && type !== 'image/png') {
    return 'Допустимы изображения JPG и PNG.';
  }
  const name = file.name.toLowerCase();
  const extOk =
    name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
  if (!type && !extOk) {
    return 'Допустимы изображения JPG и PNG.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Максимальный размер файла — 10 МБ.';
  }
  return null;
}
