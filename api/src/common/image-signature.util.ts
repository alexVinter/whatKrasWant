export type DetectedImage = 'jpeg' | 'png';

/**
 * Detects the real image format from the file's leading bytes (magic number).
 * Only JPEG and PNG are recognised — the approved formats for the project.
 * Returns null for anything else (including SVG/GIF/WebP or spoofed files),
 * so callers must never rely on filename/extension/client MIME alone.
 */
export function detectImageType(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}
