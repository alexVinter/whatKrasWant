import { detectImageType } from './image-signature.util';

describe('detectImageType', () => {
  it('recognises JPEG magic bytes', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('recognises PNG magic bytes', () => {
    expect(
      detectImageType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('png');
  });

  it('rejects GIF, SVG and spoofed JPEG names', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageType(Buffer.from('not-a-jpeg'))).toBeNull();
  });
});
