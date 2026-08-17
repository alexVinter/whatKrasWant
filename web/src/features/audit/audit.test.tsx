import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '../../test/testUtils';

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installAuditMock(options?: {
  loggedIn?: boolean;
  fail?: boolean;
  items?: unknown[];
}) {
  const loggedIn = options?.loggedIn ?? true;
  const fail = options?.fail ?? false;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  const defaultItems = [
    {
      id: 'log-1',
      createdAt: '2026-08-17T10:00:00.000Z',
      action: 'IDEA_UPDATED',
      entityType: 'IDEA',
      entityId: 'i1',
      actor: { id: 'a-1', login: 'admin' },
      objectLabel: 'TEST E08 IDEA',
    },
    {
      id: 'log-2',
      createdAt: '2026-08-16T10:00:00.000Z',
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: 'c1',
      actor: { id: 'a-1', login: 'admin' },
      objectLabel: 'TEST E08 CATEGORY',
    },
    {
      id: 'log-3',
      createdAt: '2026-08-15T10:00:00.000Z',
      action: 'DISTRICT_CREATED',
      entityType: 'DISTRICT',
      entityId: 'd1',
      actor: { id: 'a-1', login: 'admin' },
      objectLabel: 'Советский',
    },
  ];
  const items = options?.items ?? defaultItems;
  const calls: { url: string; method: string }[] = [];

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      calls.push({ url: rawUrl, method });

      if (path.endsWith('/api/admin/auth/session')) {
        return loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401);
      }
      if (path.endsWith('/api/admin/ideas/summary')) {
        return jsonResponse(
          { total: 0, draft: 0, published: 0, archived: 0 },
          200,
        );
      }
      if (path.endsWith('/api/admin/audit')) {
        if (fail) {
          return jsonResponse(null, 500);
        }
        const page = Number(url.searchParams.get('page') ?? 1);
        const pageSize = Number(url.searchParams.get('pageSize') ?? 100);
        return jsonResponse(
          {
            items: items.slice(0, pageSize),
            page,
            pageSize,
            total: items.length,
          },
          200,
        );
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

describe('admin audit log', () => {
  it('redirects to login without a session', async () => {
    installAuditMock({ loggedIn: false });
    renderApp('/admin/audit');
    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
  });

  it('renders the audit screen for a valid session', async () => {
    installAuditMock();
    renderApp('/admin/audit');
    expect(
      await screen.findByRole('heading', { name: 'Журнал действий' }),
    ).toBeInTheDocument();
  });

  it('renders human action labels, object labels and desktop columns', async () => {
    installAuditMock();
    renderApp('/admin/audit');

    expect(await screen.findByText('Изменена инициатива')).toBeInTheDocument();
    expect(screen.getByText('Создана категория')).toBeInTheDocument();
    expect(screen.getByText('TEST E08 IDEA')).toBeInTheDocument();
    expect(screen.getByText('TEST E08 CATEGORY')).toBeInTheDocument();
    expect(screen.queryByText('IDEA_UPDATED')).not.toBeInTheDocument();

    expect(screen.getByText('Дата и время')).toBeInTheDocument();
    expect(screen.getByText('Администратор')).toBeInTheDocument();
    expect(screen.getByText('Действие')).toBeInTheDocument();
    expect(screen.getByText('Объект')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    installAuditMock({ items: [] });
    renderApp('/admin/audit');
    expect(await screen.findByText('Записей пока нет.')).toBeInTheDocument();
  });

  it('shows an error state', async () => {
    installAuditMock({ fail: true });
    renderApp('/admin/audit');
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Не удалось загрузить журнал. Обновите страницу.');
  });

  it('shows real latest actions on the overview', async () => {
    const { calls } = installAuditMock();
    renderApp('/admin');

    await waitFor(() => {
      expect(
        calls.some((c) => c.url.includes('/api/admin/audit?page=1&pageSize=3')),
      ).toBe(true);
    });
    const panel = (await screen.findByText('Последние действия')).closest(
      'section',
    )!;
    expect(within(panel).getByText('Изменена инициатива')).toBeInTheDocument();
    expect(within(panel).getByText('TEST E08 IDEA')).toBeInTheDocument();
  });
});
