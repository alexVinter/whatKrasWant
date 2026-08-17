import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { AdminStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AdminSession, AdminUser, Category } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;

function buildCategory(overrides: Partial<Category>): Category {
  const now = new Date();
  return {
    id: `cat-${Math.random().toString(36).slice(2)}`,
    name: 'Category',
    slug: `slug-${Math.random().toString(36).slice(2)}`,
    description: null,
    icon: null,
    color: null,
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  categories: Category[] = [];

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

  category = {
    findMany: (args?: {
      orderBy?: { sortOrder?: 'asc'; name?: 'asc' }[];
    }): Promise<Category[]> => {
      const sorted = [...this.categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
      void args;
      return Promise.resolve(sorted);
    },
    aggregate: (): Promise<{ _max: { sortOrder: number | null } }> => {
      const max = this.categories.reduce(
        (acc, c) => (c.sortOrder > acc ? c.sortOrder : acc),
        0,
      );
      return Promise.resolve({
        _max: { sortOrder: this.categories.length ? max : null },
      });
    },
    create: (args: {
      data: {
        name: string;
        slug: string;
        sortOrder: number;
        isActive: boolean;
      };
    }): Promise<Category> => {
      if (this.categories.some((c) => c.slug === args.data.slug)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      const created = buildCategory(args.data);
      this.categories.push(created);
      return Promise.resolve(created);
    },
    findUnique: (args: { where: { id: string } }): Promise<Category | null> =>
      Promise.resolve(
        this.categories.find((c) => c.id === args.where.id) ?? null,
      ),
    update: (args: {
      where: { id: string };
      data: Partial<Category>;
    }): Promise<Category> => {
      const category = this.categories.find((c) => c.id === args.where.id)!;
      Object.assign(category, args.data, { updatedAt: new Date() });
      return Promise.resolve(category);
    },
  };
}

describe('CategoriesController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
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
    prisma.categories.push(
      buildCategory({ id: 'c1', name: 'Экология', slug: 'ekologiya', sortOrder: 3 }),
      buildCategory({ id: 'c2', name: 'Благоустройство', slug: 'blago', sortOrder: 1 }),
      buildCategory({ id: 'c3', name: 'Культура', slug: 'kultura', sortOrder: 2 }),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [CategoriesController],
      providers: [
        CategoriesService,
        AdminAuthService,
        AdminAuthGuard,
        { provide: PrismaService, useValue: prisma },
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

  it('rejects GET /admin/categories without a session (401)', async () => {
    await request(server()).get('/admin/categories').expect(401);
  });

  it('returns categories for an authenticated admin (200), sorted by sortOrder', async () => {
    const res = await request(server())
      .get('/admin/categories')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      'Благоустройство',
      'Культура',
      'Экология',
    ]);
    expect(res.body[0]).toHaveProperty('slug');
    expect(res.body[0]).toHaveProperty('isActive', true);
  });

  it('creates a category (201) and appends it after existing ones', async () => {
    const res = await request(server())
      .post('/admin/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Новая сфера' })
      .expect(201);

    expect(res.body.name).toBe('Новая сфера');
    expect(res.body.slug).toBe('novaya-sfera');
    expect(res.body.sortOrder).toBe(4);
    expect(res.body.isActive).toBe(true);
  });

  it('rejects a duplicate slug with 409', async () => {
    await request(server())
      .post('/admin/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Экология' })
      .expect(409);
  });

  it('rejects an empty name with 400', async () => {
    await request(server())
      .post('/admin/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: '   ' })
      .expect(400);
  });

  it('updates a category name via PATCH', async () => {
    const res = await request(server())
      .patch('/admin/categories/c1')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Экология и природа' })
      .expect(200);

    expect(res.body.name).toBe('Экология и природа');
    expect(res.body.slug).toBe('ekologiya');
  });

  it('toggles isActive via PATCH', async () => {
    const res = await request(server())
      .patch('/admin/categories/c1')
      .set('Cookie', AUTH_COOKIE)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('changes ordering when sortOrder is updated', async () => {
    await request(server())
      .patch('/admin/categories/c1')
      .set('Cookie', AUTH_COOKIE)
      .send({ sortOrder: 0 })
      .expect(200);

    const res = await request(server())
      .get('/admin/categories')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body[0].name).toBe('Экология');
  });

  it('returns 404 for an unknown category', async () => {
    await request(server())
      .patch('/admin/categories/does-not-exist')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'X' })
      .expect(404);
  });
});
