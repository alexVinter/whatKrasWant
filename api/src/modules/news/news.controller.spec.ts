/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { AdminStatus, NewsStatus } from '@prisma/client';
import type { AdminSession, AdminUser, News, NewsImage } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { AuditService } from '../audit/audit.service';
import { NewsController } from './news.controller';
import { PublicNewsController } from './public-news.controller';
import { NewsService } from './news.service';
import { NewsImageService } from './news-image.service';

class FakeStorage {
  objects = new Map<string, { body: Buffer; contentType: string }>();
  deleted: string[] = [];

  putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  getObject(key: string) {
    const stored = this.objects.get(key);
    if (!stored) {
      return Promise.reject(new Error(`missing object ${key}`));
    }
    return Promise.resolve({
      body: Readable.from([stored.body]),
      contentType: stored.contentType,
      contentLength: stored.body.length,
    });
  }

  deleteObjects(keys: string[]): Promise<void> {
    this.deleted.push(...keys);
    for (const key of keys) {
      this.objects.delete(key);
    }
    return Promise.resolve();
  }

  keysEnding(suffix: string): string[] {
    return [...this.objects.keys()].filter((key) => key.endsWith(suffix));
  }
}

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;
const BODY =
  'Текст тестовой новости E11 достаточно длинный, чтобы пройти валидацию.';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  newsRows: News[] = [];
  newsImages: NewsImage[] = [];
  auditLogs: Array<{
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: Date;
  }> = [];

  $transaction = (arg: unknown): Promise<unknown> => {
    if (typeof arg === 'function') {
      return (arg as (tx: FakePrisma) => Promise<unknown>)(this);
    }
    return Promise.all(arg as Promise<unknown>[]);
  };

  adminSession = {
    findUnique: (args: {
      where: { tokenHash: string };
    }): Promise<(AdminSession & { adminUser: AdminUser }) | null> => {
      const session =
        this.sessions.find((s) => s.tokenHash === args.where.tokenHash) ?? null;
      if (!session) return Promise.resolve(null);
      const adminUser = this.admins.find((a) => a.id === session.adminUserId)!;
      return Promise.resolve({ ...session, adminUser });
    },
  };

  private attach(news: News, include?: Record<string, unknown>) {
    const result: Record<string, unknown> = { ...news };
    if (include?.image) {
      result.image = this.newsImages.find((i) => i.newsId === news.id) ?? null;
    }
    return result;
  }

  private matches(row: News, where?: Record<string, any>): boolean {
    if (!where) return true;
    if (where.status && row.status !== where.status) return false;
    return true;
  }

  news = {
    findMany: (args: {
      where?: Record<string, any>;
      orderBy?: any;
      skip?: number;
      take?: number;
      select?: Record<string, any>;
      include?: Record<string, unknown>;
    }): Promise<any[]> => {
      let rows = this.newsRows.filter((n) => this.matches(n, args.where));
      const order = Array.isArray(args.orderBy)
        ? args.orderBy
        : args.orderBy
          ? [args.orderBy]
          : [];
      rows = [...rows].sort((a, b) => {
        for (const rule of order) {
          const key = Object.keys(rule)[0] as keyof News;
          const dir = rule[key] === 'asc' ? 1 : -1;
          const av = a[key];
          const bv = b[key];
          if (av instanceof Date && bv instanceof Date) {
            if (av.getTime() !== bv.getTime()) {
              return (av.getTime() - bv.getTime()) * dir;
            }
          } else if (av !== bv) {
            if (av == null) return 1 * dir;
            if (bv == null) return -1 * dir;
            return av > bv ? dir : -dir;
          }
        }
        return 0;
      });
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take) rows = rows.slice(0, args.take);
      return Promise.resolve(
        rows.map((row) => {
          if (args.select) {
            const picked: Record<string, unknown> = {};
            for (const key of Object.keys(args.select)) {
              if (key === 'image') {
                const img =
                  this.newsImages.find((i) => i.newsId === row.id) ?? null;
                picked.image = img && args.select.image?.select
                  ? { id: img.id }
                  : img;
              } else {
                picked[key] = (row as any)[key];
              }
            }
            return picked;
          }
          return this.attach(row, args.include);
        }),
      );
    },
    count: (args?: { where?: Record<string, any> }): Promise<number> =>
      Promise.resolve(
        this.newsRows.filter((n) => this.matches(n, args?.where)).length,
      ),
    findUnique: (args: {
      where: { id?: string; slug?: string };
      include?: Record<string, unknown>;
    }): Promise<any> => {
      const row =
        this.newsRows.find((n) =>
          args.where.id ? n.id === args.where.id : n.slug === args.where.slug,
        ) ?? null;
      if (!row) return Promise.resolve(null);
      return Promise.resolve(this.attach(row, args.include));
    },
    create: (args: { data: Record<string, any> }): Promise<News> => {
      const now = new Date();
      const row = {
        id: nextId('news'),
        createdAt: now,
        updatedAt: now,
        status: NewsStatus.DRAFT,
        publishDate: null,
        ...args.data,
      } as News;
      this.newsRows.push(row);
      return Promise.resolve(row);
    },
    update: (args: {
      where: { id: string };
      data: Record<string, any>;
    }): Promise<News> => {
      const row = this.newsRows.find((n) => n.id === args.where.id)!;
      Object.assign(row, args.data, { updatedAt: new Date() });
      return Promise.resolve({ ...row });
    },
  };

  newsImage = {
    findUnique: (args: {
      where: { newsId: string };
    }): Promise<NewsImage | null> =>
      Promise.resolve(
        this.newsImages.find((i) => i.newsId === args.where.newsId) ?? null,
      ),
    create: (args: { data: Record<string, any> }): Promise<NewsImage> => {
      const row = {
        id: nextId('nimg'),
        createdAt: new Date(),
        ...args.data,
      } as NewsImage;
      this.newsImages.push(row);
      return Promise.resolve(row);
    },
    delete: (args: {
      where: { newsId: string };
    }): Promise<{ count: number }> => {
      const before = this.newsImages.length;
      this.newsImages = this.newsImages.filter(
        (i) => i.newsId !== args.where.newsId,
      );
      return Promise.resolve({ count: before - this.newsImages.length });
    },
  };

  adminAuditLog = {
    create: (args: { data: Record<string, any> }) => {
      const row = {
        id: nextId('audit'),
        actorId: args.data.actorId ?? null,
        action: args.data.action,
        entityType: args.data.entityType,
        entityId: args.data.entityId ?? null,
        beforeJson: args.data.beforeJson ?? null,
        afterJson: args.data.afterJson ?? null,
        createdAt: new Date(Date.now() + this.auditLogs.length),
      };
      this.auditLogs.push(row);
      return Promise.resolve(row);
    },
  };
}

describe('NewsController (e2e-ish)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let storage: FakeStorage;
  let validJpeg: Buffer;
  let validPng: Buffer;

  beforeAll(async () => {
    validJpeg = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 120, g: 130, b: 140 },
      },
    })
      .jpeg()
      .toBuffer();
    validPng = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    idCounter = 0;
    prisma = new FakePrisma();
    storage = new FakeStorage();
    const now = new Date();
    prisma.admins.push({
      id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hashed:x',
      status: AdminStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
    prisma.sessions.push({
      id: 'session-1',
      adminUserId: 'admin-1',
      tokenHash: createHash('sha256').update(RAW_TOKEN).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      revokedAt: null,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [NewsController, PublicNewsController],
      providers: [
        NewsService,
        NewsImageService,
        AuditService,
        AdminAuthService,
        AdminAuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  const createDraft = async (overrides: Record<string, unknown> = {}) => {
    const res = await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'DRAFT',
        title: 'TEST E11 NEWS',
        body: BODY,
        ...overrides,
      })
      .expect(201);
    return res.body;
  };

  const upload = (id: string, file: Buffer, filename: string, type: string) =>
    request(server())
      .post(`/admin/news/${id}/image`)
      .set('Cookie', AUTH_COOKIE)
      .attach('image', file, { filename, contentType: type });

  it('rejects GET /admin/news without a session (401)', async () => {
    await request(server()).get('/admin/news').expect(401);
  });

  it('returns the admin list for an authenticated admin (200)', async () => {
    await createDraft();
    const res = await request(server())
      .get('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('TEST E11 NEWS');
  });

  it('creates a DRAFT without a publish date', async () => {
    const news = await createDraft();
    expect(news.status).toBe('DRAFT');
    expect(news.publishDate).toBeNull();
    expect(news.slug).toBe('test-e11-news');
  });

  it('creates a PUBLISHED news when a date is provided', async () => {
    const res = await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'Опубликованная новость',
        body: BODY,
        publishDate: '2026-08-11',
      })
      .expect(201);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.publishDate).toBeTruthy();
  });

  it('rejects publish without a date (400)', async () => {
    const news = await createDraft();
    await request(server())
      .post(`/admin/news/${news.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(400);
  });

  it('updates title and body', async () => {
    const news = await createDraft();
    const res = await request(server())
      .patch(`/admin/news/${news.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Новый заголовок', body: BODY })
      .expect(200);
    expect(res.body.title).toBe('Новый заголовок');
    expect(res.body.slug).toBe(news.slug);
  });

  it('does not write audit on a no-op PATCH', async () => {
    const news = await createDraft();
    const before = prisma.auditLogs.length;
    await request(server())
      .patch(`/admin/news/${news.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'TEST E11 NEWS', body: BODY })
      .expect(200);
    expect(prisma.auditLogs).toHaveLength(before);
  });

  it('publishes a draft with a date', async () => {
    const news = await createDraft({ publishDate: '2026-08-11' });
    const res = await request(server())
      .post(`/admin/news/${news.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.status).toBe('PUBLISHED');
  });

  it('unpublishes without clearing publishDate', async () => {
    const created = await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'Снять с публикации',
        body: BODY,
        publishDate: '2026-08-11',
      })
      .expect(201);
    const res = await request(server())
      .post(`/admin/news/${created.body.id}/unpublish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.publishDate).toBeTruthy();
  });

  it('returns 404 for an unknown news item', async () => {
    await request(server())
      .get('/admin/news/does-not-exist')
      .set('Cookie', AUTH_COOKIE)
      .expect(404);
  });

  it('rejects XLSX-style secrets and storage keys in responses', async () => {
    const news = await createDraft();
    await upload(news.id, validJpeg, 'a.jpg', 'image/jpeg').expect(200);
    const res = await request(server())
      .get(`/admin/news/${news.id}`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('originalKey');
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('minio');
  });

  it('uploads a valid JPEG', async () => {
    const news = await createDraft();
    const res = await upload(news.id, validJpeg, 'a.jpg', 'image/jpeg').expect(
      200,
    );
    expect(res.body.image.url).toContain(
      `/api/admin/news/${news.id}/image/optimized`,
    );
    expect(storage.keysEnding('/original.jpg')).toHaveLength(1);
  });

  it('uploads a valid PNG', async () => {
    const news = await createDraft();
    const res = await upload(news.id, validPng, 'a.png', 'image/png').expect(200);
    expect(res.body.image).not.toBeNull();
  });

  it('rejects an invalid signature (400)', async () => {
    const news = await createDraft();
    await upload(
      news.id,
      Buffer.from('not an image'),
      'a.jpg',
      'image/jpeg',
    ).expect(400);
  });

  it('rejects a file larger than 10 MB (400)', async () => {
    const news = await createDraft();
    const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    await upload(news.id, huge, 'huge.jpg', 'image/jpeg').expect(400);
  });

  it('replaces an image, updates cache version and deletes old objects', async () => {
    const news = await createDraft();
    const first = await upload(news.id, validJpeg, 'one.jpg', 'image/jpeg').expect(
      200,
    );
    const second = await upload(news.id, validPng, 'two.png', 'image/png').expect(
      200,
    );
    expect(second.body.image.id).not.toBe(first.body.image.id);
    expect(second.body.image.url).toContain(`v=${second.body.image.id}`);
    expect(storage.deleted.length).toBeGreaterThan(0);
  });

  it('deletes an image and storage objects', async () => {
    const news = await createDraft();
    await upload(news.id, validJpeg, 'one.jpg', 'image/jpeg').expect(200);
    const res = await request(server())
      .delete(`/admin/news/${news.id}/image`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.image).toBeNull();
    expect(prisma.newsImages).toHaveLength(0);
  });

  it('writes news and image audit records without secrets', async () => {
    const news = await createDraft({ publishDate: '2026-08-11' });
    await request(server())
      .patch(`/admin/news/${news.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Изменённый заголовок' })
      .expect(200);
    await request(server())
      .post(`/admin/news/${news.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/news/${news.id}/unpublish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await upload(news.id, validJpeg, 'one.jpg', 'image/jpeg').expect(200);
    await upload(news.id, validPng, 'two.png', 'image/png').expect(200);
    await request(server())
      .delete(`/admin/news/${news.id}/image`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const actions = prisma.auditLogs.map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'NEWS_CREATED',
        'NEWS_UPDATED',
        'NEWS_PUBLISHED',
        'NEWS_UNPUBLISHED',
        'NEWS_IMAGE_ADDED',
        'NEWS_IMAGE_REPLACED',
        'NEWS_IMAGE_REMOVED',
      ]),
    );
    expect(prisma.auditLogs.every((row) => row.actorId === 'admin-1')).toBe(
      true,
    );
    const serialized = JSON.stringify(prisma.auditLogs);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('originalKey');
    expect(serialized).not.toContain('tokenHash');
    const created = prisma.auditLogs.find((row) => row.action === 'NEWS_CREATED');
    expect((created?.afterJson as { title: string }).title).toBe('TEST E11 NEWS');
  });

  it('returns public list without auth and hides drafts', async () => {
    await createDraft({ title: 'Черновик публичный' });
    await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'Первая опубликованная',
        body: BODY,
        publishDate: '2026-08-10',
      })
      .expect(201);
    await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'Вторая опубликованная',
        body: BODY,
        publishDate: '2026-08-12',
      })
      .expect(201);

    const res = await request(server()).get('/public/news').expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].title).toBe('Вторая опубликованная');
    expect(res.body.items[1].title).toBe('Первая опубликованная');
    expect(res.body.items.some((item: { title: string }) => item.title.includes('Черновик'))).toBe(
      false,
    );
  });

  it('paginates the public list', async () => {
    await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'A',
        body: BODY,
        publishDate: '2026-08-01',
      })
      .expect(201);
    await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'B',
        body: BODY,
        publishDate: '2026-08-02',
      })
      .expect(201);
    const res = await request(server())
      .get('/public/news?page=1&pageSize=1')
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(2);
    expect(res.body.pageSize).toBe(1);
  });

  it('returns a published public detail and 404 for draft/unknown', async () => {
    const published = await request(server())
      .post('/admin/news')
      .set('Cookie', AUTH_COOKIE)
      .send({
        action: 'PUBLISH',
        title: 'Деталь',
        body: BODY,
        publishDate: '2026-08-11',
      })
      .expect(201);
    const draft = await createDraft({ title: 'Скрытый черновик' });

    const ok = await request(server())
      .get(`/public/news/${published.body.slug}`)
      .expect(200);
    expect(ok.body.title).toBe('Деталь');
    expect(ok.body.status).toBeUndefined();
    expect(JSON.stringify(ok.body)).not.toContain('originalKey');

    await request(server()).get(`/public/news/${draft.slug}`).expect(404);
    await request(server()).get('/public/news/unknown-slug').expect(404);
  });
});
