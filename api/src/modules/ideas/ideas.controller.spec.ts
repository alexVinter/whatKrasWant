/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { AdminStatus } from '@prisma/client';
import type {
  AdminSession,
  AdminUser,
  District,
  Idea,
  IdeaImage,
  IdeaRevision,
  IdeaTopic,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';
import { IdeaImageService } from './idea-image.service';
import { AuditService } from '../audit/audit.service';

/** In-memory stand-in for the S3-compatible storage (no real MinIO needed). */
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

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

interface IdeaDistrictRow {
  ideaId: string;
  districtId: string;
}

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  ideaTopics: IdeaTopic[] = [];
  districts: District[] = [];
  ideas: Idea[] = [];
  ideaDistricts: IdeaDistrictRow[] = [];
  ideaRevisions: IdeaRevision[] = [];
  ideaImages: IdeaImage[] = [];
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
  private publicNumber = 0;

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

  ideaTopic = {
    findUnique: (args: { where: { id: string } }): Promise<IdeaTopic | null> =>
      Promise.resolve(
        this.ideaTopics.find((t) => t.id === args.where.id) ?? null,
      ),
  };

  district = {
    findMany: (args: {
      where?: { id?: { in?: string[] } };
    }): Promise<District[]> => {
      const ids = args.where?.id?.in;
      const rows = ids
        ? this.districts.filter((d) => ids.includes(d.id))
        : this.districts;
      return Promise.resolve(rows);
    },
  };

  private attachIncludes(idea: Idea, include?: Record<string, unknown>) {
    const result: Record<string, unknown> = { ...idea };
    if (include?.topic) {
      result.topic =
        this.ideaTopics.find((t) => t.id === idea.topicId) ?? null;
    }
    if (include?.districts) {
      result.districts = this.ideaDistricts
        .filter((r) => r.ideaId === idea.id)
        .map((r) => ({
          ideaId: r.ideaId,
          districtId: r.districtId,
          district: this.districts.find((d) => d.id === r.districtId) ?? null,
        }));
    }
    if (include?.image) {
      result.image = this.ideaImages.find((i) => i.ideaId === idea.id) ?? null;
    }
    return result;
  }

  private matches(idea: Idea, where?: Record<string, any>): boolean {
    if (!where) return true;
    if (where.status && idea.status !== where.status) return false;
    if (where.territoryType && idea.territoryType !== where.territoryType) {
      return false;
    }
    if (where.OR) {
      const ok = (where.OR as any[]).some((cond) => {
        if (cond.title?.contains !== undefined) {
          return idea.title
            .toLowerCase()
            .includes(String(cond.title.contains).toLowerCase());
        }
        if (cond.expertName?.contains !== undefined) {
          return (idea.expertName ?? '')
            .toLowerCase()
            .includes(String(cond.expertName.contains).toLowerCase());
        }
        return false;
      });
      if (!ok) return false;
    }
    if (where.districts?.some?.districtId) {
      const target = where.districts.some.districtId;
      if (
        !this.ideaDistricts.some(
          (r) => r.ideaId === idea.id && r.districtId === target,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  idea = {
    create: (args: { data: Record<string, any> }): Promise<Idea> => {
      const now = new Date();
      this.publicNumber += 1;
      const idea = {
        id: nextId('idea'),
        publicNumber: this.publicNumber,
        slug: args.data.slug,
        sourceType: args.data.sourceType,
        expertName: args.data.expertName ?? null,
        expertOrg: args.data.expertOrg ?? null,
        title: args.data.title,
        description: args.data.description,
        topicId: args.data.topicId ?? null,
        territoryType: args.data.territoryType,
        address: args.data.address ?? null,
        latitude: args.data.latitude ?? null,
        longitude: args.data.longitude ?? null,
        status: args.data.status,
        isTop20: false,
        submittedAt: null,
        publishedAt: args.data.publishedAt ?? null,
        createdAt: now,
        updatedAt: now,
      } as Idea;
      this.ideas.push(idea);
      return Promise.resolve(idea);
    },
    findUnique: (args: {
      where: { id?: string; slug?: string };
      include?: Record<string, unknown>;
    }): Promise<any> => {
      const idea =
        this.ideas.find(
          (i) =>
            (args.where.id !== undefined && i.id === args.where.id) ||
            (args.where.slug !== undefined && i.slug === args.where.slug),
        ) ?? null;
      if (!idea) return Promise.resolve(null);
      return Promise.resolve(this.attachIncludes(idea, args.include));
    },
    findMany: (args: {
      where?: Record<string, any>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
      include?: Record<string, unknown>;
    }): Promise<any[]> => {
      let rows = this.ideas.filter((i) => this.matches(i, args.where));
      rows = rows.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
      if (args.skip) rows = rows.slice(args.skip);
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      return Promise.resolve(rows.map((i) => this.attachIncludes(i, args.include)));
    },
    count: (args?: { where?: Record<string, any> }): Promise<number> =>
      Promise.resolve(
        this.ideas.filter((i) => this.matches(i, args?.where)).length,
      ),
    update: (args: {
      where: { id: string };
      data: Record<string, any>;
    }): Promise<Idea> => {
      const idea = this.ideas.find((i) => i.id === args.where.id)!;
      Object.assign(idea, args.data, { updatedAt: new Date() });
      return Promise.resolve(idea);
    },
  };

  ideaDistrict = {
    createMany: (args: {
      data: IdeaDistrictRow[];
    }): Promise<{ count: number }> => {
      this.ideaDistricts.push(...args.data);
      return Promise.resolve({ count: args.data.length });
    },
    deleteMany: (args: {
      where: { ideaId: string };
    }): Promise<{ count: number }> => {
      const before = this.ideaDistricts.length;
      this.ideaDistricts = this.ideaDistricts.filter(
        (r) => r.ideaId !== args.where.ideaId,
      );
      return Promise.resolve({ count: before - this.ideaDistricts.length });
    },
  };

  ideaRevision = {
    create: (args: { data: Record<string, any> }): Promise<IdeaRevision> => {
      const revision = {
        id: nextId('rev'),
        ideaId: args.data.ideaId,
        actorAdminId: args.data.actorAdminId ?? null,
        snapshotJson: args.data.snapshotJson,
        reason: args.data.reason ?? null,
        createdAt: new Date(Date.now() + this.ideaRevisions.length),
      } as IdeaRevision;
      this.ideaRevisions.push(revision);
      return Promise.resolve(revision);
    },
    findMany: (args: {
      where: { ideaId: string };
      include?: Record<string, unknown>;
    }): Promise<any[]> => {
      const rows = this.ideaRevisions
        .filter((r) => r.ideaId === args.where.ideaId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((r) => {
          const actor = this.admins.find((a) => a.id === r.actorAdminId);
          return {
            ...r,
            actor:
              args.include?.actor && actor
                ? { id: actor.id, login: actor.login }
                : null,
          };
        });
      return Promise.resolve(rows);
    },
  };

  ideaImage = {
    findUnique: (args: {
      where: { ideaId: string };
    }): Promise<IdeaImage | null> =>
      Promise.resolve(
        this.ideaImages.find((i) => i.ideaId === args.where.ideaId) ?? null,
      ),
    upsert: (args: {
      where: { ideaId: string };
      create: Record<string, any>;
      update: Record<string, any>;
    }): Promise<IdeaImage> => {
      const existing = this.ideaImages.find(
        (i) => i.ideaId === args.where.ideaId,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return Promise.resolve(existing);
      }
      const row = {
        id: nextId('img'),
        createdAt: new Date(),
        ...args.create,
      } as IdeaImage;
      this.ideaImages.push(row);
      return Promise.resolve(row);
    },
    delete: (args: { where: { ideaId: string } }): Promise<{ count: number }> => {
      const before = this.ideaImages.length;
      this.ideaImages = this.ideaImages.filter(
        (i) => i.ideaId !== args.where.ideaId,
      );
      return Promise.resolve({ count: before - this.ideaImages.length });
    },
    create: (args: { data: Record<string, any> }): Promise<IdeaImage> => {
      const row = {
        id: nextId('img'),
        createdAt: new Date(),
        ...args.data,
      } as IdeaImage;
      this.ideaImages.push(row);
      return Promise.resolve(row);
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

function buildDistrict(overrides: Partial<District>): District {
  const now = new Date();
  return {
    id: randomUUID(),
    name: 'District',
    geometry: null,
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const LONG_DESC =
  'Описание инициативы, достаточно длинное для прохождения валидации минимум пятьдесят символов.';

describe('IdeasController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let storage: FakeStorage;
  let districtA: District;
  let districtB: District;
  let validJpeg: Buffer;
  let validPng: Buffer;

  beforeAll(async () => {
    validJpeg = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 120, g: 130, b: 140 },
      },
    })
      .jpeg()
      .toBuffer();
    validPng = await sharp({
      create: {
        width: 1000,
        height: 700,
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

    districtA = buildDistrict({ name: 'Центральный' });
    districtB = buildDistrict({ name: 'Советский' });
    prisma.districts.push(districtA, districtB);

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [IdeasController],
      providers: [
        IdeasService,
        IdeaImageService,
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

  const draftBody = (overrides: Record<string, unknown> = {}) => ({
    action: 'DRAFT',
    title: 'Инициатива по благоустройству набережной',
    description: LONG_DESC,
    territoryType: 'CITYWIDE',
    hasSpecificPlace: false,
    ...overrides,
  });

  const createDraft = async (overrides: Record<string, unknown> = {}) => {
    const res = await request(server())
      .post('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .send(draftBody(overrides))
      .expect(201);
    return res.body;
  };

  it('rejects GET list without a session (401)', async () => {
    await request(server()).get('/admin/ideas').expect(401);
  });

  it('returns list for an authenticated admin (200)', async () => {
    await createDraft({ title: 'Первая инициатива набережной города' });
    const res = await request(server())
      .get('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
  });

  it('searches by title and by expertName', async () => {
    await createDraft({ title: 'Уникальный парк возле реки Кача' });
    await createDraft({
      title: 'Другая инициатива для проверки поиска списка',
      expertName: 'Иванов Иван',
    });

    const byTitle = await request(server())
      .get('/admin/ideas')
      .query({ search: 'Уникальный' })
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(byTitle.body.total).toBe(1);

    const byExpert = await request(server())
      .get('/admin/ideas')
      .query({ search: 'Иванов' })
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(byExpert.body.total).toBe(1);
  });

  it('filters by status and territory', async () => {
    await createDraft({
      title: 'Черновик по районам центрального района',
      territoryType: 'DISTRICTS',
      districtIds: [districtA.id],
    });
    await createDraft({
      action: 'PUBLISH',
      title: 'Опубликованная инициатива города Красноярска',
      territoryType: 'CITYWIDE',
    });

    const byStatus = await request(server())
      .get('/admin/ideas')
      .query({ status: 'PUBLISHED' })
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(byStatus.body.total).toBe(1);

    const byDistrict = await request(server())
      .get('/admin/ideas')
      .query({ territory: districtA.id })
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(byDistrict.body.total).toBe(1);

    const cityWide = await request(server())
      .get('/admin/ideas')
      .query({ territory: 'CITYWIDE' })
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(cityWide.body.total).toBe(1);
  });

  it('creates a DRAFT as EXPERT and records the first revision', async () => {
    const idea = await createDraft();
    expect(idea.status).toBe('DRAFT');
    expect(idea.sourceType).toBe('EXPERT');

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body).toHaveLength(1);
    expect(revisions.body[0].actor.login).toBe('admin');
  });

  it('creates a PUBLISHED idea with valid data', async () => {
    const idea = await createDraft({
      action: 'PUBLISH',
    });
    expect(idea.status).toBe('PUBLISHED');
    expect(idea.publishedAt).not.toBeNull();
  });

  it('saves district relations and skips them for city-wide', async () => {
    const withDistricts = await createDraft({
      territoryType: 'DISTRICTS',
      districtIds: [districtA.id, districtB.id],
    });
    expect(withDistricts.districtIds.sort()).toEqual(
      [districtA.id, districtB.id].sort(),
    );

    const cityWide = await createDraft({ territoryType: 'CITYWIDE' });
    expect(cityWide.districtIds).toHaveLength(0);
  });

  it('rejects specific place without address or coordinates (400)', async () => {
    await request(server())
      .post('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .send(draftBody({ hasSpecificPlace: true, latitude: 56, longitude: 92 }))
      .expect(400);

    await request(server())
      .post('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .send(draftBody({ hasSpecificPlace: true, address: 'проспект Мира, 1' }))
      .expect(400);
  });

  it('rejects specific place outside Krasnoyarsk on create (400)', async () => {
    const res = await request(server())
      .post('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .send(
        draftBody({
          hasSpecificPlace: true,
          address: 'Москва, Красная площадь',
          latitude: 55.7558,
          longitude: 37.6173,
        }),
      )
      .expect(400);

    expect(res.body.message).toContain('Укажите точку в границах Красноярска');
  });

  it('accepts specific place inside Krasnoyarsk on create (201)', async () => {
    const res = await request(server())
      .post('/admin/ideas')
      .set('Cookie', AUTH_COOKIE)
      .send(
        draftBody({
          hasSpecificPlace: true,
          address: 'проспект Мира, 1',
          latitude: 56.0153,
          longitude: 92.8932,
        }),
      )
      .expect(201);

    expect(res.body.latitude).toBe(56.0153);
    expect(res.body.longitude).toBe(92.8932);
  });

  it('rejects update with coordinates outside Krasnoyarsk (400)', async () => {
    const idea = await createDraft({
      hasSpecificPlace: true,
      address: 'проспект Мира, 1',
      latitude: 56.0153,
      longitude: 92.8932,
    });

    const res = await request(server())
      .patch(`/admin/ideas/${idea.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({
        latitude: 55.7558,
        longitude: 37.6173,
        reason: 'Попытка перенести точку',
      })
      .expect(400);

    expect(res.body.message).toContain('Укажите точку в границах Красноярска');
  });

  it('updates fields and creates a revision, but a no-op PATCH does not', async () => {
    const idea = await createDraft();

    await request(server())
      .patch(`/admin/ideas/${idea.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Обновлённое название инициативы города', reason: 'Правка' })
      .expect(200);

    let revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body).toHaveLength(2);
    expect(revisions.body[0].reason).toBe('Правка');

    // No-op PATCH (same title) must not add another revision.
    await request(server())
      .patch(`/admin/ideas/${idea.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Обновлённое название инициативы города' })
      .expect(200);

    revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body).toHaveLength(2);
  });

  it('publishes a draft, unpublishes and archives it', async () => {
    const idea = await createDraft();

    const published = await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');

    const unpublished = await request(server())
      .post(`/admin/ideas/${idea.id}/unpublish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(unpublished.body.status).toBe('DRAFT');
    expect(unpublished.body.publishedAt).not.toBeNull();

    const archived = await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');
  });

  it('restores ARCHIVED to DRAFT and records one revision', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    const archived = await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(archived.body.publishedAt).not.toBeNull();

    const restored = await request(server())
      .post(`/admin/ideas/${idea.id}/restore`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(restored.body.status).toBe('DRAFT');
    expect(restored.body.publishedAt).not.toBeNull();

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body[0].reason).toBe('Инициатива восстановлена');
  });

  it('rejects restore for a non-ARCHIVED initiative (400)', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/restore`)
      .set('Cookie', AUTH_COOKIE)
      .expect(400);
  });

  it('rejects publish for an ARCHIVED initiative (400)', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(400);
  });

  it('allows publish after restore from ARCHIVED', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/ideas/${idea.id}/restore`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const published = await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
  });

  it('keeps revisions append-only and ordered newest first', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body).toHaveLength(2);
    expect(revisions.body[0].reason).toBe('Инициатива опубликована');
    expect(revisions.body[1].reason).toBe('Инициатива создана');
  });

  it('computes real summary counts', async () => {
    await createDraft();
    await createDraft({ action: 'PUBLISH' });
    const archivedIdea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${archivedIdea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    const summary = await request(server())
      .get('/admin/ideas/summary')
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(summary.body).toEqual({
      total: 3,
      draft: 1,
      published: 1,
      archived: 1,
    });
  });

  it('returns 404 for an unknown idea', async () => {
    await request(server())
      .get('/admin/ideas/does-not-exist')
      .set('Cookie', AUTH_COOKIE)
      .expect(404);
  });

  it('rejects summary without a session (401)', async () => {
    await request(server()).get('/admin/ideas/summary').expect(401);
  });

  const upload = (ideaId: string, file: Buffer, filename: string, type: string) =>
    request(server())
      .post(`/admin/ideas/${ideaId}/image`)
      .set('Cookie', AUTH_COOKIE)
      .attach('image', file, { filename, contentType: type });

  it('rejects image upload without a session (401)', async () => {
    const idea = await createDraft();
    await request(server())
      .post(`/admin/ideas/${idea.id}/image`)
      .attach('image', validJpeg, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });

  it('rejects image upload for an unknown idea (404)', async () => {
    await upload('does-not-exist', validJpeg, 'a.jpg', 'image/jpeg').expect(404);
  });

  it('uploads a valid JPEG and stores original/optimized/thumbnail', async () => {
    const idea = await createDraft();
    const res = await upload(idea.id, validJpeg, 'photo.jpg', 'image/jpeg').expect(200);

    expect(res.body.image).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        url: expect.stringContaining(`/api/admin/ideas/${idea.id}/image/optimized`),
        thumbnailUrl: expect.stringContaining(
          `/api/admin/ideas/${idea.id}/image/thumbnail`,
        ),
      }),
    );
    expect(res.body.image.url).not.toContain('minio');
    expect(prisma.ideaImages).toHaveLength(1);
    expect(storage.keysEnding('/original.jpg')).toHaveLength(1);
    expect(storage.keysEnding('/optimized.jpg')).toHaveLength(1);
    expect(storage.keysEnding('/thumbnail.jpg')).toHaveLength(1);

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body[0].reason).toBe('Добавлено изображение');
  });

  it('uploads a valid PNG', async () => {
    const idea = await createDraft();
    const res = await upload(idea.id, validPng, 'photo.png', 'image/png').expect(200);
    expect(res.body.image).not.toBeNull();
    expect(storage.keysEnding('/original.png')).toHaveLength(1);
  });

  it('rejects a file larger than 10 MB (400)', async () => {
    const idea = await createDraft();
    const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    await upload(idea.id, huge, 'huge.jpg', 'image/jpeg').expect(400);
    expect(prisma.ideaImages).toHaveLength(0);
  });

  it('rejects invalid MIME / non-image payload (400)', async () => {
    const idea = await createDraft();
    await upload(
      idea.id,
      Buffer.from('not an image'),
      'note.txt',
      'text/plain',
    ).expect(400);
  });

  it('rejects a fake .jpg with a wrong signature (400)', async () => {
    const idea = await createDraft();
    await upload(
      idea.id,
      Buffer.from('GIF89a-not-a-jpeg'),
      'spoof.jpg',
      'image/jpeg',
    ).expect(400);
    expect(prisma.ideaImages).toHaveLength(0);
  });

  it('strips EXIF metadata from the optimized variant', async () => {
    const idea = await createDraft();
    const withExif = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .withMetadata({
        exif: { IFD0: { Copyright: 'GPS-SHOULD-NOT-SURVIVE' } },
      })
      .jpeg()
      .toBuffer();

    await upload(idea.id, withExif, 'exif.jpg', 'image/jpeg').expect(200);
    const optimizedKey = storage.keysEnding('/optimized.jpg')[0];
    const optimized = storage.objects.get(optimizedKey)!.body;
    expect(optimized.includes(Buffer.from('GPS-SHOULD-NOT-SURVIVE'))).toBe(
      false,
    );
  });

  it('replaces an existing image, updates metadata and deletes old objects', async () => {
    const idea = await createDraft();
    await upload(idea.id, validJpeg, 'one.jpg', 'image/jpeg').expect(200);
    const firstKeys = [...storage.objects.keys()];
    const firstId = prisma.ideaImages[0].id;

    const res = await upload(idea.id, validPng, 'two.png', 'image/png').expect(200);
    expect(prisma.ideaImages).toHaveLength(1);
    expect(prisma.ideaImages[0].id).not.toBe(firstId);
    expect(prisma.ideaImages[0].mimeType).toBe('image/png');
    expect(res.body.image.url).toContain(`v=${prisma.ideaImages[0].id}`);

    for (const key of firstKeys) {
      expect(storage.deleted).toContain(key);
      expect(storage.objects.has(key)).toBe(false);
    }
    expect(storage.keysEnding('/original.png')).toHaveLength(1);

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body[0].reason).toBe('Изображение заменено');
  });

  it('deletes the image record and storage objects', async () => {
    const idea = await createDraft();
    await upload(idea.id, validJpeg, 'one.jpg', 'image/jpeg').expect(200);
    const keys = [...storage.objects.keys()];

    const res = await request(server())
      .delete(`/admin/ideas/${idea.id}/image`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(res.body.image).toBeNull();
    expect(prisma.ideaImages).toHaveLength(0);
    for (const key of keys) {
      expect(storage.deleted).toContain(key);
    }

    const revisions = await request(server())
      .get(`/admin/ideas/${idea.id}/revisions`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(revisions.body[0].reason).toBe('Изображение удалено');
  });

  it('allows publishing an idea without an image', async () => {
    const idea = await createDraft();
    const published = await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    expect(published.body.image).toBeNull();
  });

  it('writes idea and image audit records without secrets', async () => {
    const idea = await createDraft();
    expect(prisma.auditLogs.map((row) => row.action)).toEqual(['IDEA_CREATED']);
    expect(prisma.auditLogs[0].actorId).toBe('admin-1');
    expect(JSON.stringify(prisma.auditLogs[0])).not.toContain('passwordHash');
    expect(JSON.stringify(prisma.auditLogs[0].afterJson)).not.toContain(
      'originalKey',
    );

    await request(server())
      .patch(`/admin/ideas/${idea.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Обновлённое название инициативы города' })
      .expect(200);
    await request(server())
      .patch(`/admin/ideas/${idea.id}`)
      .set('Cookie', AUTH_COOKIE)
      .send({ title: 'Обновлённое название инициативы города' })
      .expect(200);
    expect(
      prisma.auditLogs.filter((row) => row.action === 'IDEA_UPDATED'),
    ).toHaveLength(1);

    await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/ideas/${idea.id}/publish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    expect(
      prisma.auditLogs.filter((row) => row.action === 'IDEA_PUBLISHED'),
    ).toHaveLength(1);

    await request(server())
      .post(`/admin/ideas/${idea.id}/unpublish`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/ideas/${idea.id}/archive`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);
    await request(server())
      .post(`/admin/ideas/${idea.id}/restore`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    await upload(idea.id, validJpeg, 'one.jpg', 'image/jpeg').expect(200);
    await upload(idea.id, validPng, 'two.png', 'image/png').expect(200);
    await request(server())
      .delete(`/admin/ideas/${idea.id}/image`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(prisma.auditLogs.map((row) => row.action)).toEqual([
      'IDEA_CREATED',
      'IDEA_UPDATED',
      'IDEA_PUBLISHED',
      'IDEA_UNPUBLISHED',
      'IDEA_ARCHIVED',
      'IDEA_RESTORED',
      'IDEA_IMAGE_ADDED',
      'IDEA_IMAGE_REPLACED',
      'IDEA_IMAGE_REMOVED',
    ]);
    expect(
      (prisma.auditLogs.find((row) => row.action === 'IDEA_IMAGE_ADDED')
        ?.afterJson as { hasImage?: boolean })?.hasImage,
    ).toBe(true);
  });
});
