import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/testUtils';
import type { AdminSettings } from './types';

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ALL_FALSE: AdminSettings = {
  PUBLIC_CATALOG: false,
  PUBLIC_SUBMISSION: false,
  VOTING: false,
  RESULTS: false,
};

function installSettingsMock(options?: {
  loggedIn?: boolean;
  failSave?: boolean;
  initial?: AdminSettings;
}) {
  const loggedIn = options?.loggedIn ?? true;
  const failSave = options?.failSave ?? false;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  let stored: AdminSettings = { ...(options?.initial ?? ALL_FALSE) };
  const calls: { url: string; method: string; body?: string }[] = [];

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url: rawUrl, method, body });

      if (path.endsWith('/api/admin/auth/session')) {
        return loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401);
      }
      if (path.endsWith('/api/admin/settings')) {
        if (method === 'GET') {
          return jsonResponse({ ...stored }, 200);
        }
        if (method === 'PATCH') {
          if (failSave) {
            return jsonResponse(null, 500);
          }
          stored = JSON.parse(body ?? '{}') as AdminSettings;
          return jsonResponse({ ...stored }, 200);
        }
      }
      if (path.endsWith('/api/admin/audit')) {
        return jsonResponse({ items: [], page: 1, pageSize: 100, total: 0 }, 200);
      }
      if (path.endsWith('/api/admin/ideas/summary')) {
        return jsonResponse(
          { total: 0, draft: 0, published: 0, archived: 0 },
          200,
        );
      }
      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  return { calls, getStored: () => stored };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin settings', () => {
  it('redirects to login without a session', async () => {
    installSettingsMock({ loggedIn: false });
    renderApp('/admin/settings');
    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
  });

  it('shows the settings page for a valid session', async () => {
    installSettingsMock();
    renderApp('/admin/settings');
    expect(
      await screen.findByRole('heading', { name: 'Публичность' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });

  it('loads the four settings and their labels', async () => {
    installSettingsMock({
      initial: {
        PUBLIC_CATALOG: true,
        PUBLIC_SUBMISSION: false,
        VOTING: false,
        RESULTS: false,
      },
    });
    renderApp('/admin/settings');

    expect(
      await screen.findByText('Публичная карта и инициативы'),
    ).toBeInTheDocument();
    expect(screen.getByText('Приём инициатив')).toBeInTheDocument();
    expect(screen.getByText('Голосование')).toBeInTheDocument();
    expect(screen.getByText('Рейтинг инициатив')).toBeInTheDocument();
    expect(
      screen.getByText('Открывает публичную карту и страницы инициатив.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Разрешает отправку идеи после VK-авторизации.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Разрешает поддержку инициатив.')).toBeInTheDocument();
    expect(
      screen.getByText('Показывает рейтинг по действительным голосам.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('switch', { name: 'Публичная карта и инициативы' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('switch', { name: 'Приём инициатив' }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles a flag in local state before save', async () => {
    installSettingsMock();
    renderApp('/admin/settings');

    const catalog = await screen.findByRole('switch', {
      name: 'Публичная карта и инициативы',
    });
    expect(catalog).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(catalog);
    expect(catalog).toHaveAttribute('aria-checked', 'true');
  });

  it('sends PATCH on save and keeps the saved state', async () => {
    const { calls } = installSettingsMock();
    renderApp('/admin/settings');

    await userEvent.click(
      await screen.findByRole('switch', { name: 'Публичная карта и инициативы' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        calls.some((call) => call.url.endsWith('/api/admin/settings') && call.method === 'PATCH'),
      ).toBe(true);
    });

    const patch = calls.find(
      (call) => call.url.endsWith('/api/admin/settings') && call.method === 'PATCH',
    );
    expect(JSON.parse(patch?.body ?? '{}')).toEqual({
      PUBLIC_CATALOG: true,
      PUBLIC_SUBMISSION: false,
      VOTING: false,
      RESULTS: false,
    });
    expect(
      screen.getByRole('switch', { name: 'Публичная карта и инициативы' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('shows server values after a reload', async () => {
    const { getStored } = installSettingsMock();
    const first = renderApp('/admin/settings');

    await userEvent.click(
      await screen.findByRole('switch', { name: 'Публичная карта и инициативы' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => {
      expect(getStored().PUBLIC_CATALOG).toBe(true);
    });
    first.unmount();

    renderApp('/admin/settings');
    expect(
      await screen.findByRole('switch', { name: 'Публичная карта и инициативы' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps chosen values when save fails', async () => {
    installSettingsMock({ failSave: true });
    renderApp('/admin/settings');

    const catalog = await screen.findByRole('switch', {
      name: 'Публичная карта и инициативы',
    });
    await userEvent.click(catalog);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось сохранить настройки. Попробуйте ещё раз.',
    );
    expect(catalog).toHaveAttribute('aria-checked', 'true');
  });

  it('does not send PATCH when nothing changed', async () => {
    const { calls } = installSettingsMock();
    renderApp('/admin/settings');

    await screen.findByRole('switch', { name: 'Публичная карта и инициативы' });
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        calls.some((call) => call.url.endsWith('/api/admin/settings') && call.method === 'GET'),
      ).toBe(true);
    });
    expect(
      calls.some((call) => call.url.endsWith('/api/admin/settings') && call.method === 'PATCH'),
    ).toBe(false);
  });
});
