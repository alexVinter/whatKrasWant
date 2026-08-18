import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp } from '../../test/testUtils';
const PROJECT_COPY_MATCH =
  /Общественная инициатива, которая собирает идеи горожан о развитии/;
import type { PublicConfig } from '../taxonomy/types';
import type { PublicIdeaDetail, PublicIdeaListItem } from './types';
import type { PublicNewsListItem } from '../news/types';

interface Call {
  url: string;
  method: string;
}

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultConfig = (overrides?: Partial<PublicConfig['features']>): PublicConfig => ({
  categories: [],
  districts: [],
  features: {
    PUBLIC_CATALOG: false,
    PUBLIC_SUBMISSION: false,
    VOTING: false,
    RESULTS: false,
    ...overrides,
  },
});

const publicNews: PublicNewsListItem[] = [
  {
    slug: 'news-a',
    title: 'Новость A',
    publishDate: '2026-08-12T00:00:00.000Z',
    thumbnailUrl: null,
  },
];

const publicIdeas: PublicIdeaListItem[] = [
  {
    slug: 'idea-a',
    title: 'Инициатива A',
    authorName: 'Иван Иванов',
    publishedAt: '2026-08-10T00:00:00.000Z',
    territory: 'Центральный район — пр. Мира',
    voteCount: 0,
    thumbnailUrl: null,
  },
];

const publicDetail: PublicIdeaDetail = {
  slug: 'idea-a',
  title: 'Инициатива A',
  description: 'Описание инициативы для публичной детальной страницы.',
  authorName: 'Иван Иванов',
  territory: 'Центральный район · пр. Мира',
  address: 'пр. Мира',
  latitude: 56.01,
  longitude: 92.87,
  publishedAt: '2026-08-10T00:00:00.000Z',
  voteCount: 0,
  image: null,
};

function installPublicMock(options?: {
  features?: Partial<PublicConfig['features']>;
  ideasStatus?: number;
  emptyNews?: boolean;
}) {
  const calls: Call[] = [];
  const features = {
    ...defaultConfig().features,
    ...options?.features,
  };

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      calls.push({ url: rawUrl, method });

      if (path.endsWith('/api/public/config')) {
        return jsonResponse(defaultConfig(features), 200);
      }
      if (path.endsWith('/api/public/news')) {
        const items = options?.emptyNews ? [] : publicNews;
        return jsonResponse(
          { items, page: 1, pageSize: 50, total: items.length },
          200,
        );
      }
      if (path.endsWith('/api/public/ideas') && method === 'GET') {
        return jsonResponse(
          options?.ideasStatus === 404
            ? { message: 'Not Found' }
            : { items: publicIdeas, page: 1, pageSize: 100, total: 1 },
          options?.ideasStatus ?? 200,
        );
      }
      if (path.endsWith('/api/public/map/ideas')) {
        return jsonResponse(
          options?.ideasStatus === 404
            ? { message: 'Not Found' }
            : {
                items: [
                  {
                    slug: 'idea-a',
                    title: 'Инициатива A',
                    authorName: 'Иван Иванов',
                    latitude: 56.01,
                    longitude: 92.87,
                  },
                ],
              },
          options?.ideasStatus ?? 200,
        );
      }
      if (path.endsWith('/api/public/ideas/idea-a') && method === 'GET') {
        return jsonResponse(
          options?.ideasStatus === 404 ? { message: 'Not Found' } : publicDetail,
          options?.ideasStatus ?? 200,
        );
      }
      if (path.endsWith('/api/public/ideas/unknown-slug')) {
        return jsonResponse({ message: 'Not Found' }, 404);
      }

      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  return { calls, mock };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Public catalog E12', () => {
  it('renders homepage project copy without auth', async () => {
    installPublicMock();
    renderApp('/');
    expect(await screen.findByText(PROJECT_COPY_MATCH)).toBeInTheDocument();
  });

  it('does not request map ideas when PUBLIC_CATALOG=false', async () => {
    const { calls } = installPublicMock({ features: { PUBLIC_CATALOG: false } });
    renderApp('/');
    await screen.findByText(PROJECT_COPY_MATCH);
    expect(calls.some((call) => call.url.includes('/api/public/map/ideas'))).toBe(
      false,
    );
  });

  it('shows map section on homepage', async () => {
    installPublicMock();
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Инициативы на карте города' }),
    ).toBeInTheDocument();
  });

  it('shows map markers request only when PUBLIC_CATALOG=true', async () => {
    const { calls } = installPublicMock({ features: { PUBLIC_CATALOG: true } });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Инициативы на карте города' });
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/api/public/map/ideas'))).toBe(
        true,
      );
    });
  });

  it('shows rating section with mock cards when catalog is empty', async () => {
    installPublicMock({ features: { PUBLIC_CATALOG: false } });
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Рейтинг инициатив' }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText('Рейтинг инициатив').length).toBeGreaterThan(0);
  });

  it('shows mock news cards when no published news', async () => {
    installPublicMock({ emptyNews: true });
    renderApp('/');
    await waitFor(() => {
      expect(screen.getAllByText('Дата публикации').length).toBe(3);
    });
    expect(screen.getAllByText('Название новости').length).toBe(3);
  });

  it('links news slider to /news', async () => {
    installPublicMock({ emptyNews: true });
    renderApp('/');
    const viewAllLinks = await screen.findAllByRole('link', { name: 'Смотреть все' });
    expect(viewAllLinks.some((link) => link.getAttribute('href') === '/news')).toBe(
      true,
    );
  });

  it('renders all four nav links on homepage', async () => {
    installPublicMock();
    renderApp('/');
    await screen.findByText(PROJECT_COPY_MATCH);
    expect(screen.getByRole('link', { name: 'О проекте', hidden: true })).toHaveAttribute(
      'href',
      '#project',
    );
    expect(screen.getByRole('link', { name: 'Карта', hidden: true })).toHaveAttribute(
      'href',
      '#map',
    );
    expect(
      screen.getByRole('link', { name: 'Рейтинг инициатив', hidden: true }),
    ).toHaveAttribute('href', '#rating');
    expect(screen.getByRole('link', { name: 'Новости', hidden: true })).toHaveAttribute(
      'href',
      '#news',
    );
  });

  it('keeps submit CTA disabled when PUBLIC_SUBMISSION=false', async () => {
    installPublicMock({ features: { PUBLIC_SUBMISSION: false } });
    renderApp('/');
    const buttons = await screen.findAllByRole('button', {
      name: 'Предложить идею',
    });
    expect(buttons[0]).toBeDisabled();
  });

  it('closes /initiatives when PUBLIC_CATALOG=false', async () => {
    installPublicMock({ features: { PUBLIC_CATALOG: false }, ideasStatus: 404 });
    renderApp('/initiatives');
    expect(
      await screen.findByText('Каталог инициатив временно недоступен.'),
    ).toBeInTheDocument();
  });

  it('lists initiatives when PUBLIC_CATALOG=true', async () => {
    installPublicMock({ features: { PUBLIC_CATALOG: true } });
    renderApp('/initiatives');
    expect(await screen.findByText('Инициатива A')).toBeInTheDocument();
    expect(screen.getByText(/Автор: Иван Иванов/)).toBeInTheDocument();
    expect(screen.queryByText(/Источник/i)).not.toBeInTheDocument();
  });

  it('renders initiative detail and disabled support button', async () => {
    installPublicMock({ features: { PUBLIC_CATALOG: true, VOTING: false } });
    renderApp('/initiatives/idea-a');
    expect(await screen.findByRole('heading', { name: 'Инициатива A' })).toBeInTheDocument();
    expect(screen.getByText(/Описание инициативы/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Поддержать' })).toBeDisabled();
  });

  it('handles unknown initiative slug', async () => {
    installPublicMock({ features: { PUBLIC_CATALOG: true }, ideasStatus: 404 });
    renderApp('/initiatives/unknown-slug');
    await waitFor(() => {
      expect(screen.getByText('Инициатива не найдена.')).toBeInTheDocument();
    });
  });
});
