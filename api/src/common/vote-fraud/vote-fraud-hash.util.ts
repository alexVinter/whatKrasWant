import { createHmac } from 'node:crypto';

export function hashVoteFingerprint(
  secret: string,
  value: string | undefined | null,
): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return createHmac('sha256', secret).update(normalized).digest('hex');
}

export function normalizeClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
): string | null {
  const forwarded = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const candidate = forwarded?.split(',')[0]?.trim() || remoteAddress?.trim();
  return candidate || null;
}
