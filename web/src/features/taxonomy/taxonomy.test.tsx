import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/testUtils';

interface MockOptions {
  loggedIn?: boolean;
  createCategoryStatus?: number;
}

interface Row {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installTaxonomyFetchMock(options?: MockOptions) {
  const loggedIn = options?.loggedIn ?? true;
  const createCategoryStatus = options?.createCategoryStatus ?? 201;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };

  const now = new Date().toISOString();
  const categories: Row[] = [
    { id: 'c1', name: 'Экология', slug: 'ekologiya', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: 'c2', name: 'Культура', slug: 'kultura', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  ];
  const districts: Row[] = [
    { id: 'd1', name: 'Центральный', slug: '', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
  ];

  const sortRows = (rows: Row[]) =>
    [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};

      if (url.endsWith('/api/admin/auth/session')) {
        return loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401);
      }

      if (url.includes('/api/admin/categories')) {
        if (method === 'GET') return jsonResponse(sortRows(categories), 200);
        if (method === 'POST') {
          if (createCategoryStatus !== 201) {
            return jsonResponse({ message: 'conflict' }, createCategoryStatus);
          }
          const created: Row = {
            id: `c-${categories.length + 1}`,
            name: body.name,
            slug: 'generated',
            sortOrder: body.sortOrder ?? categories.length + 1,
            isActive: body.isActive ?? true,
            createdAt: now,
            updatedAt: now,
          };
          categories.push(created);
          return jsonResponse(created, 201);
        }
        if (method === 'PATCH') {
          const id = url.split('/').pop()!;
          const row = categories.find((c) => c.id === id)!;
          Object.assign(row, body);
          return jsonResponse(row, 200);
        }
      }

      if (url.includes('/api/admin/districts')) {
        if (method === 'GET') return jsonResponse(sortRows(districts), 200);
        if (method === 'POST') {
          const created: Row = {
            id: `d-${districts.length + 1}`,
            name: body.name,
            slug: '',
            sortOrder: body.sortOrder ?? districts.length + 1,
            isActive: body.isActive ?? true,
            createdAt: now,
            updatedAt: now,
          };
          districts.push(created);
          return jsonResponse(created, 201);
        }
        if (method === 'PATCH') {
          const id = url.split('/').pop()!;
          const row = districts.find((d) => d.id === id)!;
          Object.assign(row, body);
          return jsonResponse(row, 200);
        }
      }

      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  return { mock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin taxonomy screen', () => {
  it('redirects to login without a session', async () => {
    installTaxonomyFetchMock({ loggedIn: false });
    renderApp('/admin/taxonomy');

    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Категории и районы' })).not.toBeInTheDocument();
  });

  it('renders categories and districts from the API for an authenticated admin', async () => {
    installTaxonomyFetchMock();
    renderApp('/admin/taxonomy');

    expect(
      await screen.findByRole('heading', { name: 'Категории' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Районы' })).toBeInTheDocument();
    expect(await screen.findByText('Экология')).toBeInTheDocument();
    expect(screen.getByText('Культура')).toBeInTheDocument();
    expect(screen.getByText('Центральный')).toBeInTheDocument();
  });

  it('opens the create dialog and adds a category via POST', async () => {
    installTaxonomyFetchMock();
    renderApp('/admin/taxonomy');

    await screen.findByText('Экология');
    const addButtons = screen.getAllByRole('button', { name: 'Добавить' });
    await userEvent.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Новая категория')).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByLabelText('Название'),
      'Новая тестовая',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Новая тестовая')).toBeInTheDocument();
  });

  it('opens the edit dialog for an existing category and updates it via PATCH', async () => {
    installTaxonomyFetchMock();
    renderApp('/admin/taxonomy');

    await userEvent.click(await screen.findByRole('button', { name: /Экология/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Категория')).toBeInTheDocument();

    const nameInput = within(dialog).getByLabelText('Название');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Экология и природа');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Экология и природа')).toBeInTheDocument();
  });

  it('adds a district via POST', async () => {
    installTaxonomyFetchMock();
    renderApp('/admin/taxonomy');

    await screen.findByText('Центральный');
    const addButtons = screen.getAllByRole('button', { name: 'Добавить' });
    await userEvent.click(addButtons[1]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Новый район')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Название'), 'Тестовый район');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Тестовый район')).toBeInTheDocument();
  });

  it('shows a human-readable error when the backend rejects creation', async () => {
    installTaxonomyFetchMock({ createCategoryStatus: 409 });
    renderApp('/admin/taxonomy');

    await screen.findByText('Экология');
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить' })[0]);

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Название'), 'Экология');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'уже существует',
    );
  });
});
