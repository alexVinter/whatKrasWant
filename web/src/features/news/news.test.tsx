import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/testUtils';
import {
  FOOTER_EMAIL,
  FOOTER_PARTNERS,
  FOOTER_SUPPORT_PHRASE,
} from '../../layouts/PublicLayout/footer';
import type { AdminNewsDetail, PublicNewsDetail, PublicNewsListItem } from './types';

interface Call {
  url: string;
  method: string;
  credentials?: RequestCredentials;
  body?: string | FormData;
}

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeNews(
  overrides: Partial<AdminNewsDetail> = {},
): AdminNewsDetail {
  return {
    id: 'news-1',
    slug: 'test-e11-news',
    title: 'TEST E11 NEWS',
    body: 'Текст тестовой новости',
    publishDate: '2026-08-11T00:00:00.000Z',
    status: 'DRAFT',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    image: null,
    ...overrides,
  };
}

function installNewsMock(options?: { loggedIn?: boolean }) {
  const loggedIn = options?.loggedIn ?? true;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  const calls: Call[] = [];
  let news = makeNews();
  const publicItems: PublicNewsListItem[] = [
    {
      slug: 'newer',
      title: 'Свежая новость',
      publishDate: '2026-08-12T00:00:00.000Z',
      thumbnailUrl: '/api/public/news/newer/image/thumbnail?v=1',
    },
    {
      slug: 'older',
      title: 'Старая новость',
      publishDate: '2026-08-01T00:00:00.000Z',
      thumbnailUrl: null,
    },
  ];
  const publicDetails: Record<string, PublicNewsDetail> = {
    newer: {
      slug: 'newer',
      title: 'Свежая новость',
      body: 'Полный текст свежей новости',
      publishDate: '2026-08-12T00:00:00.000Z',
      image: { url: '/api/public/news/newer/image/optimized?v=1' },
    },
  };

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      calls.push({
        url: rawUrl,
        method,
        credentials: init?.credentials,
        body: init?.body as string | FormData | undefined,
      });

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
        return jsonResponse({ items: [], page: 1, pageSize: 3, total: 0 }, 200);
      }
      if (path.endsWith('/api/admin/news') && method === 'GET') {
        return jsonResponse({ items: [news] }, 200);
      }
      if (path.endsWith('/api/admin/news') && method === 'POST') {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        news = makeNews({
          title: payload.title,
          body: payload.body,
          publishDate: payload.publishDate ?? null,
          status: payload.action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT',
        });
        return jsonResponse(news, 201);
      }
      if (path === `/api/admin/news/${news.id}` && method === 'GET') {
        return jsonResponse(news, 200);
      }
      if (path === `/api/admin/news/${news.id}` && method === 'PATCH') {
        const payload = JSON.parse(String(init?.body ?? '{}'));
        news = {
          ...news,
          ...payload,
          updatedAt: '2026-08-12T00:00:00.000Z',
        };
        return jsonResponse(news, 200);
      }
      if (path.endsWith('/publish') && method === 'POST') {
        news = { ...news, status: 'PUBLISHED' };
        return jsonResponse(news, 200);
      }
      if (path.endsWith('/unpublish') && method === 'POST') {
        news = { ...news, status: 'DRAFT' };
        return jsonResponse(news, 200);
      }
      if (path.endsWith('/image') && method === 'POST') {
        news = {
          ...news,
          image: {
            id: 'img-2',
            url: `/api/admin/news/${news.id}/image/optimized?v=img-2`,
            thumbnailUrl: `/api/admin/news/${news.id}/image/thumbnail?v=img-2`,
          },
        };
        return jsonResponse(news, 200);
      }
      if (path.endsWith('/image') && method === 'DELETE') {
        news = { ...news, image: null };
        return jsonResponse(news, 200);
      }
      if (path.endsWith('/api/public/news') && method === 'GET') {
        return jsonResponse(
          { items: publicItems, page: 1, pageSize: 50, total: 2 },
          200,
        );
      }
      if (path.startsWith('/api/public/news/')) {
        const slug = decodeURIComponent(path.split('/').pop() ?? '');
        const detail = publicDetails[slug];
        return detail ? jsonResponse(detail, 200) : jsonResponse(null, 404);
      }
      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  return { calls, getNews: () => news };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin news', () => {
  it('redirects to login without a session', async () => {
    installNewsMock({ loggedIn: false });
    renderApp('/admin/news');
    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
  });

  it('renders the news list', async () => {
    installNewsMock();
    renderApp('/admin/news');
    expect(
      await screen.findByRole('heading', { name: 'Новости' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText('TEST E11 NEWS')).not.toHaveLength(0);
    expect(screen.getAllByText('Черновик').length).toBeGreaterThan(0);
    const addButton = screen.getByRole('button', { name: 'Добавить новость' });
    expect(addButton.textContent).toBe('Добавить новость');
    expect(addButton.textContent).not.toContain('+');
  });

  it('opens the add-news form', async () => {
    installNewsMock();
    renderApp('/admin/news');
    await screen.findByRole('heading', { name: 'Новости' });
    const addButton = screen.getByRole('button', { name: 'Добавить новость' });
    expect(addButton).toBeInTheDocument();
    expect(addButton.textContent).not.toContain('+');
    await userEvent.click(addButton);
    expect(
      await screen.findByRole('heading', { name: 'Новость' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Название/)).toBeInTheDocument();
  });

  it('saves a draft and publishes from the form', async () => {
    const { calls } = installNewsMock();
    renderApp('/admin/news/new');
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Название/ }),
      'Новая новость',
    );
    await userEvent.type(screen.getByLabelText('Текст новости'), 'Текст');
    await userEvent.type(screen.getByLabelText('Дата публикации'), '2026-08-11');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
    await waitFor(() => {
      expect(
        calls.some(
          (call) =>
            call.url.endsWith('/api/admin/news') &&
            call.method === 'POST' &&
            String(call.body).includes('"action":"DRAFT"'),
        ),
      ).toBe(true);
    });
  });

  it('shows validation when publishing without a date', async () => {
    installNewsMock();
    renderApp('/admin/news/new');
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Название/ }),
      'Новость',
    );
    await userEvent.type(screen.getByLabelText('Текст новости'), 'Текст');
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Для публикации укажите дату публикации.',
    );
  });

  it('edits, publishes and unpublishes an existing news item', async () => {
    const { calls } = installNewsMock();
    renderApp('/admin/news/news-1');
    const title = await screen.findByLabelText(/Название/);
    await userEvent.clear(title);
    await userEvent.type(title, 'Обновлённый заголовок');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
    await waitFor(() => {
      expect(
        calls.some(
          (call) => call.method === 'PATCH' && call.url.includes('/api/admin/news/news-1'),
        ),
      ).toBe(true);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/publish'))).toBe(true);
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Снять с публикации' }),
    );
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/unpublish'))).toBe(true);
    });
  });

  it('previews a local file immediately and revokes the object URL', async () => {
    installNewsMock();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:news-one');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
    renderApp('/admin/news/news-1');
    await screen.findByLabelText(/Название/);
    const file = new File(['abc'], 'one.jpg', { type: 'image/jpeg' });
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(screen.getByAltText('Изображение (необязательно)')).toHaveAttribute(
      'src',
      'blob:news-one',
    );
    const second = new File(['def'], 'two.png', { type: 'image/png' });
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      second,
    );
    expect(createObjectURL.mock.calls.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it('does not PATCH when only the image changes', async () => {
    const { calls } = installNewsMock();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:news-img');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderApp('/admin/news/news-1');
    await screen.findByLabelText(/Название/);
    const file = new File(['abc'], 'one.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith('/image') && call.method === 'POST')).toBe(
        true,
      );
    });
    expect(
      calls.some(
        (call) => call.method === 'PATCH' && call.url.includes('/api/admin/news/news-1'),
      ),
    ).toBe(false);
  });

  it('opens news from the overview quick action', async () => {
    installNewsMock();
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Обзор' });
    await userEvent.click(screen.getAllByRole('link', { name: 'Новости' })[0]);
    expect(
      await screen.findByRole('heading', { name: 'Новости' }),
    ).toBeInTheDocument();
  });
});

describe('public news', () => {
  it('renders /news without an admin session', async () => {
    installNewsMock({ loggedIn: false });
    renderApp('/news');
    expect(await screen.findByRole('heading', { name: 'Новости' })).toBeInTheDocument();
    expect(await screen.findByText('Свежая новость')).toBeInTheDocument();
    expect(screen.getByText('Старая новость')).toBeInTheDocument();
    expect(screen.queryByLabelText('Логин')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders cards with date, title and links, newest first', async () => {
    installNewsMock({ loggedIn: false });
    renderApp('/news');
    const links = await screen.findAllByRole('link', { name: /новость/i });
    const cardLinks = links.filter((link) =>
      link.getAttribute('href')?.startsWith('/news/'),
    );
    expect(cardLinks[0]).toHaveAttribute('href', '/news/newer');
    expect(cardLinks[1]).toHaveAttribute('href', '/news/older');
    expect(screen.getByText('12.08.2026')).toBeInTheDocument();
    expect(
      document.querySelector('img[src*="/api/public/news/"]'),
    ).toHaveAttribute('src', '/api/public/news/newer/image/thumbnail?v=1');
  });

  it('renders a public detail and a 404 state', async () => {
    installNewsMock({ loggedIn: false });
    renderApp('/news/newer');
    expect(await screen.findByRole('heading', { name: 'Свежая новость' })).toBeInTheDocument();
    expect(screen.getByText('Полный текст свежей новости')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Назад к новостям' })).toHaveAttribute(
      'href',
      '/news',
    );

    renderApp('/news/missing');
    expect(
      await screen.findByRole('heading', { name: 'Новость не найдена' }),
    ).toBeInTheDocument();
  });

  it('renders the approved public footer', async () => {
    installNewsMock({ loggedIn: false });
    renderApp('/news');
    await screen.findByRole('heading', { name: 'Новости' });

    expect(screen.getByText(FOOTER_SUPPORT_PHRASE)).toBeInTheDocument();
    expect(screen.getByText(FOOTER_EMAIL)).toBeInTheDocument();
    expect(screen.getByText('vvv@fond.ensib.ru')).toBeInTheDocument();
    expect(screen.queryByText('vvv@fond.esib.ru')).not.toBeInTheDocument();

    for (const partner of FOOTER_PARTNERS) {
      expect(screen.queryByText(partner.name)).not.toBeInTheDocument();
      const slot = screen.getByLabelText(partner.name);
      if (partner.src) {
        expect(slot.querySelector('img')).toHaveAttribute('src', partner.src);
      } else {
        expect(slot.querySelector('img')).toBeNull();
      }
    }
  });
});
