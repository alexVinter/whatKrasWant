import { apiFetch, ApiError } from '../../shared/api/client';
import type { AdminStatistics } from './types';

export function getAdminStatistics(): Promise<AdminStatistics> {
  return apiFetch<AdminStatistics>('/api/admin/statistics');
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  const raw = decodeURIComponent((utfMatch?.[1] ?? plainMatch?.[1] ?? '').trim());
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    return null;
  }
  return raw;
}

export async function downloadStatisticsXlsx(): Promise<void> {
  const response = await fetch('/api/admin/statistics/xlsx', {
    credentials: 'include',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ApiError(response.status || 500);
  }
  const filename =
    filenameFromDisposition(response.headers.get('Content-Disposition')) ??
    'initiatives.xlsx';
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
