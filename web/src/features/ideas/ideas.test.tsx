/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/testUtils';

interface Call {
  url: string;
  method: string;
  body: any;
}

function jsonResponse(body: unknown, status: number): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installMock(options?: { loggedIn?: boolean; failImage?: boolean }) {
  const loggedIn = options?.loggedIn ?? true;
  const failImage = options?.failImage ?? false;
  const admin = { id: 'a-1', login: 'admin', email: 'admin@example.com' };
  const now = new Date().toISOString();
  const calls: Call[] = [];

  const categories = [
    { id: 'c1', name: 'Транспорт', slug: 'transport', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: 'c2', name: 'Экология', slug: 'ekologiya', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  ];
  const districts = [
    { id: 'd1', name: 'Центральный', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: 'd2', name: 'Советский', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  ];

  interface StoredIdea {
    id: string;
    publicNumber: number;
    slug: string;
    sourceType: 'EXPERT';
    expertName: string | null;
    expertOrg: string | null;
    title: string;
    description: string;
    categoryId: string | null;
    territoryType: 'DISTRICTS' | 'CITYWIDE';
    districtIds: string[];
    hasSpecificPlace: boolean;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    status: 'DRAFT' | 'MODERATION' | 'PUBLISHED' | 'ARCHIVED';
    isTop20: boolean;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    image: { id: string; url: string; thumbnailUrl: string } | null;
    revisions: { id: string; reason: string; createdAt: string; actor: any; snapshot: any }[];
  }

  let seq = 1;
  let imageSeq = 1;
  const revoked: string[] = [];
  const ideas: StoredIdea[] = [
    {
      id: 'i1',
      publicNumber: 1,
      slug: 'sushchestvuyushchaya',
      sourceType: 'EXPERT',
      expertName: 'Иван Иванов',
      expertOrg: null,
      title: 'Существующая инициатива города',
      description:
        'Описание существующей инициативы, достаточно длинное для валидации ровно.',
      categoryId: 'c1',
      territoryType: 'CITYWIDE',
      districtIds: [],
      hasSpecificPlace: false,
      address: null,
      latitude: null,
      longitude: null,
      status: 'DRAFT',
      isTop20: false,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      image: {
        id: 'img-1',
        url: '/api/admin/ideas/i1/image/optimized?v=img-1',
        thumbnailUrl: '/api/admin/ideas/i1/image/thumbnail?v=img-1',
      },
      revisions: [
        { id: 'r1', reason: 'Инициатива создана', createdAt: now, actor: { id: 'a-1', login: 'admin' }, snapshot: {} },
      ],
    },
  ];

  const category = (id: string | null) =>
    id ? categories.find((c) => c.id === id) ?? null : null;

  const listItem = (idea: StoredIdea) => ({
    id: idea.id,
    publicNumber: idea.publicNumber,
    title: idea.title,
    sourceType: idea.sourceType,
    expertName: idea.expertName,
    category: category(idea.categoryId)
      ? { id: idea.categoryId, name: category(idea.categoryId)!.name }
      : null,
    territoryType: idea.territoryType,
    districts: idea.districtIds.map((did) => ({
      id: did,
      name: districts.find((d) => d.id === did)!.name,
    })),
    status: idea.status,
    updatedAt: idea.updatedAt,
  });

  const detail = (idea: StoredIdea) => ({
    ...idea,
    category: category(idea.categoryId)
      ? { id: idea.categoryId, name: category(idea.categoryId)!.name, isActive: true }
      : null,
    districts: idea.districtIds.map((did) => ({
      id: did,
      name: districts.find((d) => d.id === did)!.name,
    })),
  });

  const addRevision = (idea: StoredIdea, reason: string) => {
    idea.revisions.push({
      id: `r-${idea.revisions.length + 1}`,
      reason,
      createdAt: new Date().toISOString(),
      actor: { id: 'a-1', login: 'admin' },
      snapshot: {},
    });
    idea.updatedAt = new Date(Date.now() + idea.revisions.length).toISOString();
  };

  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const rawUrl = String(input);
      const url = new URL(rawUrl, 'http://localhost');
      const path = url.pathname;
      const method = init?.method ?? 'GET';
      let body: any = {};
      if (typeof FormData !== 'undefined' && init?.body instanceof FormData) {
        body = { form: true, hasImage: init.body.has('image') };
      } else if (typeof init?.body === 'string' && init.body.length > 0) {
        body = JSON.parse(init.body);
      }
      calls.push({ url: rawUrl, method, body });

      if (path.endsWith('/api/admin/auth/session')) {
        return loggedIn ? jsonResponse({ admin }, 200) : jsonResponse(null, 401);
      }
      if (path.endsWith('/api/admin/categories')) {
        return jsonResponse(categories, 200);
      }
      if (path.endsWith('/api/admin/districts')) {
        return jsonResponse(districts, 200);
      }
      if (path.endsWith('/api/admin/ideas/summary')) {
        return jsonResponse(
          {
            total: ideas.length,
            draft: ideas.filter((i) => i.status === 'DRAFT').length,
            published: ideas.filter((i) => i.status === 'PUBLISHED').length,
            archived: ideas.filter((i) => i.status === 'ARCHIVED').length,
          },
          200,
        );
      }
      if (path.endsWith('/api/admin/audit')) {
        return jsonResponse(
          { items: [], page: 1, pageSize: 100, total: 0 },
          200,
        );
      }

      const revMatch = path.match(/\/api\/admin\/ideas\/([^/]+)\/revisions$/);
      if (revMatch) {
        const idea = ideas.find((i) => i.id === revMatch[1])!;
        return jsonResponse([...idea.revisions].reverse(), 200);
      }

      const actionMatch = path.match(
        /\/api\/admin\/ideas\/([^/]+)\/(publish|unpublish|archive|restore)$/,
      );
      if (actionMatch && method === 'POST') {
        const idea = ideas.find((i) => i.id === actionMatch[1])!;
        if (actionMatch[2] === 'publish') {
          if (idea.status === 'ARCHIVED') {
            return jsonResponse(null, 400);
          }
          idea.status = 'PUBLISHED';
          idea.publishedAt = new Date().toISOString();
          addRevision(idea, 'Инициатива опубликована');
        } else if (actionMatch[2] === 'unpublish') {
          idea.status = 'DRAFT';
          addRevision(idea, 'Инициатива снята с публикации');
        } else if (actionMatch[2] === 'archive') {
          idea.status = 'ARCHIVED';
          addRevision(idea, 'Инициатива архивирована');
        } else if (actionMatch[2] === 'restore') {
          if (idea.status !== 'ARCHIVED') {
            return jsonResponse(null, 400);
          }
          idea.status = 'DRAFT';
          addRevision(idea, 'Инициатива восстановлена');
        }
        return jsonResponse(detail(idea), 200);
      }

      const imageMatch = path.match(/\/api\/admin\/ideas\/([^/]+)\/image$/);
      if (imageMatch && (method === 'POST' || method === 'DELETE')) {
        const idea = ideas.find((i) => i.id === imageMatch[1]);
        if (!idea) return jsonResponse(null, 404);
        if (failImage && method === 'POST') {
          return jsonResponse(null, 400);
        }
        if (method === 'POST') {
          const replaced = idea.image !== null;
          imageSeq += 1;
          const imageId = `img-${imageSeq}`;
          idea.image = {
            id: imageId,
            url: `/api/admin/ideas/${idea.id}/image/optimized?v=${imageId}`,
            thumbnailUrl: `/api/admin/ideas/${idea.id}/image/thumbnail?v=${imageId}`,
          };
          addRevision(idea, replaced ? 'Изображение заменено' : 'Добавлено изображение');
        } else {
          idea.image = null;
          addRevision(idea, 'Изображение удалено');
        }
        return jsonResponse(detail(idea), 200);
      }

      if (path.match(/\/api\/admin\/ideas\/[^/]+\/image\/(optimized|thumbnail)$/)) {
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }

      const idMatch = path.match(/\/api\/admin\/ideas\/([^/]+)$/);
      if (idMatch && idMatch[1] !== 'new') {
        const idea = ideas.find((i) => i.id === idMatch[1]);
        if (!idea) return jsonResponse(null, 404);
        if (method === 'PATCH') {
          Object.assign(idea, {
            expertName: body.expertName ?? idea.expertName,
            title: body.title ?? idea.title,
            description: body.description ?? idea.description,
            categoryId:
              body.categoryId !== undefined ? body.categoryId : idea.categoryId,
          });
          addRevision(idea, body.reason || 'Инициатива изменена');
          return jsonResponse(detail(idea), 200);
        }
        return jsonResponse(detail(idea), 200);
      }

      if (path.endsWith('/api/admin/ideas')) {
        if (method === 'POST') {
          seq += 1;
          const created: StoredIdea = {
            id: `i${seq}`,
            publicNumber: seq,
            slug: `idea-${seq}`,
            sourceType: 'EXPERT',
            expertName: body.expertName ?? null,
            expertOrg: body.expertOrg ?? null,
            title: body.title,
            description: body.description,
            categoryId: body.categoryId ?? null,
            territoryType: body.territoryType,
            districtIds: body.districtIds ?? [],
            hasSpecificPlace: body.hasSpecificPlace ?? false,
            address: body.address ?? null,
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
            status: body.action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT',
            isTop20: false,
            publishedAt: body.action === 'PUBLISH' ? new Date().toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            image: null,
            revisions: [
              { id: 'r1', reason: 'Инициатива создана', createdAt: new Date().toISOString(), actor: { id: 'a-1', login: 'admin' }, snapshot: {} },
            ],
          };
          ideas.push(created);
          return jsonResponse(detail(created), 201);
        }
        // GET list
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        let items = ideas.map(listItem);
        if (search) {
          items = items.filter((i) =>
            i.title.toLowerCase().includes(search.toLowerCase()),
          );
        }
        if (status) {
          items = items.filter((i) => i.status === status);
        }
        return jsonResponse(
          { items, total: items.length, page: 1, pageSize: 20 },
          200,
        );
      }

      return jsonResponse(null, 404);
    },
  );

  vi.stubGlobal('fetch', mock);
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (obj: Blob) => `blob:${(obj as File).name ?? 'file'}`,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        revoked.push(String(url));
      },
    });
  } else {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (obj) => `blob:${(obj as File).name ?? 'file'}`,
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(String(url));
    });
  }
  return { calls, revoked };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LONG_DESC =
  'Описание новой инициативы, достаточно длинное чтобы пройти валидацию минимум пятьдесят символов.';

describe('admin initiatives', () => {
  it('redirects to login without a session', async () => {
    installMock({ loggedIn: false });
    renderApp('/admin/initiatives');
    expect(await screen.findByLabelText('Логин')).toBeInTheDocument();
  });

  it('loads the initiatives list', async () => {
    installMock();
    renderApp('/admin/initiatives');
    expect(
      await screen.findByText('Существующая инициатива города'),
    ).toBeInTheDocument();
  });

  it('sends the search filter to the API', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives');
    await screen.findByText('Существующая инициатива города');

    await userEvent.type(
      screen.getByLabelText('Поиск по названию'),
      'Парк',
    );

    await waitFor(() => {
      expect(
        calls.some((c) => c.url.includes('/api/admin/ideas?') && c.url.includes('search=')),
      ).toBe(true);
    });
  });

  it('navigates to the create page from the add button', async () => {
    installMock();
    renderApp('/admin/initiatives');
    await screen.findByText('Существующая инициатива города');

    await userEvent.click(screen.getByRole('button', { name: /Добавить/ }));

    expect(
      await screen.findByRole('heading', { name: 'Создание экспертной инициативы' }),
    ).toBeInTheDocument();
  });

  it('uses real categories and districts in the create form', async () => {
    installMock();
    renderApp('/admin/initiatives/new');

    expect(await screen.findByRole('option', { name: 'Транспорт' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Территория'), 'DISTRICTS');
    expect(await screen.findByLabelText('Центральный')).toBeInTheDocument();
  });

  it('saves a draft via POST', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/new');

    await screen.findByLabelText('Название');
    await userEvent.type(
      screen.getByLabelText('Название'),
      'Новая тестовая инициатива',
    );
    await userEvent.type(screen.getByLabelText('Описание'), LONG_DESC);
    await userEvent.click(
      screen.getByRole('button', { name: 'Сохранить черновик' }),
    );

    await waitFor(() => {
      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/api/admin/ideas'),
      );
      expect(post?.body.action).toBe('DRAFT');
    });
  });

  it('publishes via POST from the create form', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/new');

    await screen.findByLabelText('Название');
    await userEvent.type(
      screen.getByLabelText('Название'),
      'Публикуемая инициатива города',
    );
    await userEvent.type(screen.getByLabelText('Описание'), LONG_DESC);
    await userEvent.selectOptions(screen.getByLabelText('Категория'), 'c1');
    await userEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/api/admin/ideas'),
      );
      expect(post?.body.action).toBe('PUBLISH');
    });
  });

  it('shows a validation error for a too-short title', async () => {
    installMock();
    renderApp('/admin/initiatives/new');

    await screen.findByLabelText('Название');
    await userEvent.type(screen.getByLabelText('Название'), 'Коротко');
    await userEvent.type(screen.getByLabelText('Описание'), LONG_DESC);
    await userEvent.click(
      screen.getByRole('button', { name: 'Сохранить черновик' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'от 10 до 150 символов',
    );
  });

  it('opens the edit page from a list row and loads the initiative', async () => {
    installMock();
    renderApp('/admin/initiatives');

    await userEvent.click(
      await screen.findByRole('button', {
        name: /Существующая инициатива города/,
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Карточка инициативы' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveValue(
      'Существующая инициатива города',
    );
  });

  it('renders revisions from the API on the edit page', async () => {
    installMock();
    renderApp('/admin/initiatives/i1');
    expect(await screen.findByText('Инициатива создана')).toBeInTheDocument();
  });

  it('saves edits via PATCH', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');

    const titleInput = await screen.findByLabelText('Название');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Изменённое название инициативы');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.method === 'PATCH' && c.url.endsWith('/api/admin/ideas/i1'),
        ),
      ).toBe(true);
    });
  });

  it('archives an initiative from the edit page', async () => {
    installMock();
    renderApp('/admin/initiatives/i1');

    await screen.findByRole('heading', { name: 'Карточка инициативы' });
    await userEvent.click(screen.getByRole('button', { name: 'Архивировать' }));

    expect(await screen.findByText('Архив')).toBeInTheDocument();
  });

  it('shows restore instead of publish for an archived initiative', async () => {
    installMock();
    renderApp('/admin/initiatives/i1');

    await screen.findByRole('heading', { name: 'Карточка инициативы' });
    await userEvent.click(screen.getByRole('button', { name: 'Архивировать' }));
    expect(await screen.findByText('Архив')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Опубликовать' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Восстановить' })).toBeInTheDocument();
  });

  it('calls restore endpoint and updates UI to draft', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');

    await screen.findByRole('heading', { name: 'Карточка инициативы' });
    await userEvent.click(screen.getByRole('button', { name: 'Архивировать' }));
    await userEvent.click(screen.getByRole('button', { name: 'Восстановить' }));

    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === 'POST' &&
            c.url.endsWith('/api/admin/ideas/i1/restore'),
        ),
      ).toBe(true);
    });
    expect(await screen.findByText('Черновик')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeInTheDocument();
  });

  it('accepts a JPG on the create form and shows a preview', async () => {
    installMock();
    renderApp('/admin/initiatives/new');
    const input = (await screen.findByLabelText('Изображение инициативы')) as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(input, file);
    expect(await screen.findByAltText('Изображение инициативы')).toBeInTheDocument();
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:photo.jpg',
    );
  });

  it('shows an error for a non JPG/PNG file', async () => {
    installMock();
    renderApp('/admin/initiatives/new');
    const input = (await screen.findByLabelText('Изображение инициативы')) as HTMLInputElement;
    const file = new File([new Uint8Array([0x47, 0x49, 0x46])], 'a.gif', {
      type: 'image/gif',
    });
    await userEvent.upload(input, file, { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Допустимы изображения JPG и PNG.',
    );
  });

  it('shows an error for a file larger than 10 MB', async () => {
    installMock();
    renderApp('/admin/initiatives/new');
    const input = (await screen.findByLabelText('Изображение инициативы')) as HTMLInputElement;
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await userEvent.upload(input, file);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Максимальный размер файла — 10 МБ.',
    );
  });

  it('removes a selected file before submit', async () => {
    installMock();
    renderApp('/admin/initiatives/new');
    const input = (await screen.findByLabelText('Изображение инициативы')) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(screen.queryByAltText('Изображение инициативы')).not.toBeInTheDocument();
    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
  });

  it('creates the idea first and then uploads the image', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/new');
    await screen.findByLabelText('Название');
    await userEvent.type(screen.getByLabelText('Название'), 'TEST E07 IMAGE draft');
    await userEvent.type(screen.getByLabelText('Описание'), LONG_DESC);
    const input = screen.getByLabelText('Изображение инициативы') as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
        type: 'image/jpeg',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));

    await waitFor(() => {
      const create = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/api/admin/ideas'),
      );
      const upload = calls.find(
        (c) => c.method === 'POST' && String(c.url).includes('/image'),
      );
      expect(create).toBeTruthy();
      expect(upload).toBeTruthy();
      expect(calls.indexOf(create!)).toBeLessThan(calls.indexOf(upload!));
    });
  });

  it('keeps the created idea if image upload fails', async () => {
    installMock({ failImage: true });
    renderApp('/admin/initiatives/new');
    await screen.findByLabelText('Название');
    await userEvent.type(screen.getByLabelText('Название'), 'TEST E07 IMAGE fail');
    await userEvent.type(screen.getByLabelText('Описание'), LONG_DESC);
    await userEvent.upload(
      screen.getByLabelText('Изображение инициативы') as HTMLInputElement,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
        type: 'image/jpeg',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить черновик' }));

    expect(
      await screen.findByText(
        'Инициатива сохранена, но изображение загрузить не удалось.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Карточка инициативы' }),
    ).toBeInTheDocument();
  });

  it('shows an existing image on the edit page', async () => {
    installMock();
    renderApp('/admin/initiatives/i1');
    const img = await screen.findByAltText('Изображение инициативы');
    expect(img).toHaveAttribute(
      'src',
      '/api/admin/ideas/i1/image/optimized?v=img-1',
    );
  });

  it('switches preview to the local file immediately on replace', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');
    const input = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'new.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:new.jpg',
    );
    expect(screen.getByText('Новое изображение ещё не сохранено')).toBeInTheDocument();
    expect(
      calls.some(
        (c) =>
          c.method === 'POST' && c.url.endsWith('/api/admin/ideas/i1/image'),
      ),
    ).toBe(false);
  });

  it('revokes the previous object URL when selecting another replacement', async () => {
    const { revoked } = installMock();
    renderApp('/admin/initiatives/i1');
    const firstInput = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      firstInput,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'first.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:first.jpg',
    );

    const secondInput = screen.getByLabelText('Изображение инициативы', {
      selector: 'input',
    }) as HTMLInputElement;
    await userEvent.upload(
      secondInput,
      new File([new Uint8Array([0x89, 0x50, 0x4e])], 'second.png', {
        type: 'image/png',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:second.png',
    );
    expect(revoked).toContain('blob:first.jpg');
  });

  it('restores the server image if the local replacement is cleared before upload', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');
    const input = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'new.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:new.jpg',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(screen.getByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      '/api/admin/ideas/i1/image/optimized?v=img-1',
    );
    expect(
      calls.some(
        (c) =>
          c.method === 'DELETE' && c.url.endsWith('/api/admin/ideas/i1/image'),
      ),
    ).toBe(false);
  });

  it('replaces an image via POST /image after save and uses the new versioned URL', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');
    const input = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'new.jpg', {
        type: 'image/jpeg',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === 'POST' && c.url.endsWith('/api/admin/ideas/i1/image'),
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByAltText('Изображение инициативы')).toHaveAttribute(
        'src',
        '/api/admin/ideas/i1/image/optimized?v=img-2',
      );
    });
    expect(
      screen.queryByText('Новое изображение ещё не сохранено'),
    ).not.toBeInTheDocument();
  });

  it('keeps the saved server image after a failed replacement', async () => {
    const { calls } = installMock({ failImage: true });
    renderApp('/admin/initiatives/i1');
    const input = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'new.jpg', {
        type: 'image/jpeg',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить изображение.',
    );
    expect(screen.getByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:new.jpg',
    );
    expect(screen.getByText('Новое изображение ещё не сохранено')).toBeInTheDocument();
    expect(
      calls.some(
        (c) =>
          c.method === 'DELETE' && c.url.endsWith('/api/admin/ideas/i1/image'),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Убрать' }));
    expect(screen.getByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      '/api/admin/ideas/i1/image/optimized?v=img-1',
    );
  });

  it('revokes the local object URL on unmount', async () => {
    const { revoked } = installMock();
    const view = renderApp('/admin/initiatives/i1');
    const input = (await screen.findByLabelText('Изображение инициативы', {
      selector: 'input',
    })) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([new Uint8Array([0xff, 0xd8, 0xff])], 'new.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(await screen.findByAltText('Изображение инициативы')).toHaveAttribute(
      'src',
      'blob:new.jpg',
    );
    view.unmount();
    expect(revoked).toContain('blob:new.jpg');
  });

  it('deletes an image via DELETE /image and updates the UI', async () => {
    const { calls } = installMock();
    renderApp('/admin/initiatives/i1');
    await screen.findByAltText('Изображение инициативы');
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === 'DELETE' && c.url.endsWith('/api/admin/ideas/i1/image'),
        ),
      ).toBe(true);
    });
    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
  });

  it('shows real summary counts on the overview', async () => {
    installMock();
    renderApp('/admin');

    const total = await screen.findByText('Всего инициатив');
    const card = total.closest('div')!;
    await waitFor(() => {
      expect(within(card).getByText('1')).toBeInTheDocument();
    });
  });
});
