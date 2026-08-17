export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Small centralized fetch helper for the admin frontend.
 * - always same-origin relative /api URLs (proxied by Nginx);
 * - always sends the HttpOnly session cookie (credentials: include);
 * - never surfaces backend technical error details to the caller.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : (undefined as T));
}
