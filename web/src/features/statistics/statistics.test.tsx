import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/testUtils';
import type { AdminStatistics } from './types';

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE: AdminStatistics = {
  expertInitiatives: 4,
  draft: 2,
  published: 1,
  archived: 1,
  withLocation: 1,
  uncategorized: 0,
  byStatus: [],
  bySource: [],
  byCategory: [
    { id: 'c1', name: 'Благоустройство', count: 3 },
    { id: 'c2', name: 'Транспорт', count: 1 },
  ],
  byTerritory: [
    { id: 'd1', name: 'Советский', count: 2 },
    { id: 'CITYWIDE', name: 'Весь город', count: 1 },
  ],
};

function installStatisticsMock(options?: {
  loggedIn?: boolean;
  failStats?: boolean;
  failExport?: boolean;
}) {
  const loggedIn = options?.loggedIn ?? true;
  const failStats = options?.failStats ?? false;
  const failExport = options?.failExport ?? false;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  const calls: { url: string; method: string; credentials?: RequestCredentials }[] =
    [];

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      calls.push({ url: rawUrl, method, credentials: init?.credentials });

      if (path.endsWith('/api/admin/auth/session')) {
        return loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401);
      }
      if (path.endsWith('/api/admin/ideas/summary')) {
        return jsonResponse(
          { total: 4, draft: 2, published: 1, archived: 1 },
          200,
        );
      }
      if (path.endsWith('/api/admin/audit')) {
        return jsonResponse({ items: [], page: 1, pageSize: 3, total: 0 }, 200);
      }
      if (path.endsWith('/api/admin/settings')) {
        return jsonResponse(
          {
            PUBLIC_CATALOG: false,
            PUBLIC_SUBMISSION: false,
            VOTING: false,
            RESULTS: false,
          },
          200,
        );
      }
      if (path.endsWith('/api/admin/statistics/xlsx')) {
        if (failExport) {
          return jsonResponse(null, 500);
        }
        return new Response(new Uint8Array([80, 75, 3, 4]), {
          status: 200,
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
              'attachment; filename="initiatives_2026-08-17.xlsx"',
          },
        });
      }
      if (path.endsWith('/api/admin/statistics')) {
        if (failStats) {
          return jsonResponse(null, 500);
        }
        await new Promise((resolve) => setTimeout(resolve, 40));
        return jsonResponse(SAMPLE, 200);
      }
      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin statistics', () => {
  it('redirects to login without a session', async () => {
    installStatisticsMock({ loggedIn: false });
    renderApp('/admin/statistics');
    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
  });

  it('shows the statistics page for a valid session', async () => {
    installStatisticsMock();
    renderApp('/admin/statistics');
    expect(
      await screen.findByRole('heading', { name: 'Статистика' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Сформировать XLSX' }),
    ).toBeInTheDocument();
  });

  it('renders KPI values and distribution labels', async () => {
    installStatisticsMock();
    renderApp('/admin/statistics');

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Экспертные')).toBeInTheDocument();
    expect(screen.getAllByText('Черновики').length).toBeGreaterThan(0);
    expect(screen.getByText('Опубликовано')).toBeInTheDocument();
    expect(screen.getAllByText('Архив').length).toBeGreaterThan(0);
    expect(screen.getByText('По категориям')).toBeInTheDocument();
    expect(screen.getByText('Благоустройство')).toBeInTheDocument();
    expect(screen.getByText('Транспорт')).toBeInTheDocument();
    expect(screen.getByText('По территориям')).toBeInTheDocument();
    expect(screen.getByText('Советский')).toBeInTheDocument();
    expect(screen.getByText('Весь город')).toBeInTheDocument();
  });

  it('shows a loading placeholder before numbers arrive', async () => {
    installStatisticsMock();
    renderApp('/admin/statistics');
    expect(
      await screen.findByRole('heading', { name: 'Статистика' }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Загрузка').length).toBeGreaterThan(0);
    expect(await screen.findByText('4')).toBeInTheDocument();
  });

  it('shows an error when statistics fail to load', async () => {
    installStatisticsMock({ failStats: true });
    renderApp('/admin/statistics');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить статистику. Обновите страницу.',
    );
  });

  it('downloads XLSX with credentials, filename and revoked object URL', async () => {
    const { calls } = installStatisticsMock();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:xlsx-test');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderApp('/admin/statistics');
    await screen.findByText('4');
    await userEvent.click(screen.getByRole('button', { name: 'Сформировать XLSX' }));

    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.url.endsWith('/api/admin/statistics/xlsx') &&
            call.method === 'GET' &&
            call.credentials === 'include',
        ),
      ).toBe(true);
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:xlsx-test');
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('initiatives_2026-08-17.xlsx');
  });

  it('keeps the page and shows an error when export fails', async () => {
    installStatisticsMock({ failExport: true });
    renderApp('/admin/statistics');
    await screen.findByText('4');
    await userEvent.click(screen.getByRole('button', { name: 'Сформировать XLSX' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось сформировать XLSX. Попробуйте ещё раз.',
    );
    expect(
      screen.getByRole('heading', { name: 'Статистика' }),
    ).toBeInTheDocument();
  });

  it('opens statistics from the overview quick action', async () => {
    installStatisticsMock();
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Обзор' });
    await userEvent.click(
      screen.getAllByRole('link', { name: 'Статистика и выгрузка' })[0],
    );
    expect(
      await screen.findByRole('heading', { name: 'Статистика' }),
    ).toBeInTheDocument();
  });

  it('opens settings from the overview quick action', async () => {
    installStatisticsMock();
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Обзор' });
    await userEvent.click(screen.getAllByRole('link', { name: 'Настройки' })[0]);
    expect(
      await screen.findByRole('heading', { name: 'Публичность' }),
    ).toBeInTheDocument();
  });
});
