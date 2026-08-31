/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Readable } from 'node:stream';
import {
  IdeaSourceType,
  IdeaStatus,
  TerritoryType,
  type Idea,
  type IdeaImage,
  type SystemSetting,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { IdeaImageService } from '../ideas/idea-image.service';
import { IdeasService } from '../ideas/ideas.service';
import { AuditService } from '../audit/audit.service';
import { PublicIdeasController } from './public-ideas.controller';
import { PublicMapController } from './public-map.controller';
import { PublicIdeasService } from './public-ideas.service';
import { PublicSubmissionService } from './public-submission.service';
import { PublicAuthService } from '../public-auth/public-auth.service';
import { PublicAuthGuard } from '../public-auth/guards/public-auth.guard';
import { VkIdClient } from '../public-auth/vk-id.client';

class FakeStorage {
  objects = new Map<string, { body: Buffer; contentType: string }>();

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

  deleteObjects(): Promise<void> {
    return Promise.resolve();
  }
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

class FakePrisma {
  ideas: Idea[] = [];
  ideaImages: IdeaImage[] = [];
  settings: SystemSetting[] = [
    {
      key: 'PUBLIC_CATALOG',
      value: false,
      updatedBy: null,
      updatedAt: new Date(),
    },
    {
      key: 'PUBLIC_SUBMISSION',
      value: false,
      updatedBy: null,
      updatedAt: new Date(),
    },
    {
      key: 'VOTING',
      value: false,
      updatedBy: null,
      updatedAt: new Date(),
    },
    {
      key: 'RESULTS',
      value: false,
      updatedBy: null,
      updatedAt: new Date(),
    },
  ];

  $transaction = (arg: unknown): Promise<unknown> => {
    if (typeof arg === 'function') {
      return (arg as (tx: FakePrisma) => Promise<unknown>)(this);
    }
    return Promise.all(arg as Promise<unknown>[]);
  };

  systemSetting = {
    findMany: (args: { where?: { key?: { in?: string[] } } }): Promise<SystemSetting[]> => {
      const keys = args.where?.key?.in;
      if (!keys) {
        return Promise.resolve(this.settings);
      }
      return Promise.resolve(this.settings.filter((row) => keys.includes(row.key)));
    },
  };

  idea = {
    findMany: (args: any): Promise<any[]> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where.status);
      }
      if (args.where?.latitude?.not === null) {
        rows = rows.filter(
          (row) => row.latitude !== null && row.longitude !== null,
        );
      }
      if (args.where?.longitude?.not === null) {
        rows = rows.filter(
          (row) => row.latitude !== null && row.longitude !== null,
        );
      }
      const order = Array.isArray(args.orderBy)
        ? args.orderBy
        : args.orderBy
          ? [args.orderBy]
          : [];
      rows.sort((a, b) => {
        for (const rule of order) {
          const key = Object.keys(rule)[0] as keyof Idea;
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
      if (args.skip) {
        rows = rows.slice(args.skip);
      }
      if (args.take) {
        rows = rows.slice(0, args.take);
      }
      return Promise.resolve(
        rows.map((row) => {
          if (args.select) {
            return this.selectIdea(row, args.select);
          }
          const result: any = { ...row };
          if (args.include?.image) {
            result.image =
              this.ideaImages.find((img) => img.ideaId === row.id) ?? null;
          }
          if (args.include?.districts) {
            result.districts = [];
          }
          return result;
        }),
      );
    },
    findUnique: (args: any): Promise<any | null> => {
      const row =
        this.ideas.find((idea) => {
          if (args.where.id) {
            return idea.id === args.where.id;
          }
          if (args.where.slug) {
            return idea.slug === args.where.slug;
          }
          return false;
        }) ?? null;
      if (!row) {
        return Promise.resolve(null);
      }
      const result: any = { ...row };
      if (args.include?.image || args.select?.image) {
        result.image =
          this.ideaImages.find((img) => img.ideaId === row.id) ?? null;
      }
      if (args.include?.districts) {
        result.districts = [];
      }
      if (args.select) {
        return Promise.resolve(this.selectIdea(row, args.select));
      }
      return Promise.resolve(result);
    },
    count: (args: any): Promise<number> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where.status);
      }
      return Promise.resolve(rows.length);
    },
  };

  ideaImage = {
    findUnique: (args: { where: { ideaId: string } }): Promise<IdeaImage | null> =>
      Promise.resolve(
        this.ideaImages.find((img) => img.ideaId === args.where.ideaId) ?? null,
      ),
  };

  private selectIdea(row: Idea, select: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
      if (key === 'image') {
        const image =
          this.ideaImages.find((img) => img.ideaId === row.id) ?? null;
        result.image = image ? { id: image.id } : null;
      } else if (key === 'districts') {
        result.districts = [];
      } else {
        result[key] = row[key as keyof Idea];
      }
    }
    return result;
  }

  seedIdea(overrides: Partial<Idea> & Pick<Idea, 'slug' | 'title' | 'status'>) {
    const idea: Idea = {
      id: nextId('idea'),
      publicNumber: this.ideas.length + 1,
      slug: overrides.slug,
      sourceType: overrides.sourceType ?? IdeaSourceType.EXPERT,
      expertName: overrides.expertName ?? 'Иван Иванов',
      expertOrg: overrides.expertOrg ?? null,
      title: overrides.title,
      description:
        overrides.description ??
        'Описание тестовой инициативы E12 достаточно длинное для публикации и проверки публичного API.',
      topicId: overrides.topicId ?? null,
      userId: overrides.userId ?? null,
      territoryType: overrides.territoryType ?? TerritoryType.DISTRICTS,
      address: overrides.address ?? 'пр. Мира',
      latitude:
        overrides.latitude !== undefined ? overrides.latitude : 56.01,
      longitude:
        overrides.longitude !== undefined ? overrides.longitude : 92.87,
      status: overrides.status,
      isTop20: overrides.isTop20 ?? false,
      submittedAt: overrides.submittedAt ?? null,
      publishedAt:
        overrides.publishedAt ??
        (overrides.status === IdeaStatus.PUBLISHED ? new Date('2026-08-10') : null),
      createdAt: overrides.createdAt ?? new Date('2026-08-01'),
      updatedAt: overrides.updatedAt ?? new Date('2026-08-01'),
    };
    this.ideas.push(idea);
    return idea;
  }

  seedImage(ideaId: string) {
    const image: IdeaImage = {
      id: nextId('img'),
      ideaId,
      originalKey: `ideas/${ideaId}/original.jpg`,
      optimizedKey: `ideas/${ideaId}/optimized.jpg`,
      thumbnailKey: `ideas/${ideaId}/thumbnail.jpg`,
      mimeType: 'image/jpeg',
      size: 1024,
      createdAt: new Date(),
    };
    this.ideaImages.push(image);
    const buffer = Buffer.from('fake-image');
    const storage = (global as any).__fakeStorage as FakeStorage;
    storage.putObject(image.optimizedKey, buffer, 'image/jpeg');
    storage.putObject(image.thumbnailKey, buffer, 'image/jpeg');
    return image;
  }

  setCatalog(enabled: boolean) {
    const row = this.settings.find((s) => s.key === 'PUBLIC_CATALOG');
    if (row) {
      row.value = enabled;
    }
  }
}

describe('PublicIdeasController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let storage: FakeStorage;

  const server = () => app.getHttpServer();

  beforeEach(async () => {
    idCounter = 0;
    prisma = new FakePrisma();
    storage = new FakeStorage();
    (global as any).__fakeStorage = storage;

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [PublicIdeasController, PublicMapController],
      providers: [
        PublicIdeasService,
        PublicSubmissionService,
        PublicAuthService,
        PublicAuthGuard,
        VkIdClient,
        SettingsService,
        IdeaImageService,
        IdeasService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        {
          provide: AuditService,
          useValue: { write: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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

  it('returns 404 for list when PUBLIC_CATALOG=false', async () => {
    await request(server()).get('/public/ideas').expect(404);
  });

  it('returns 404 for detail when PUBLIC_CATALOG=false', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server()).get(`/public/ideas/${idea.slug}`).expect(404);
  });

  it('returns 404 for map when PUBLIC_CATALOG=false', async () => {
    prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server()).get('/public/map/ideas').expect(404);
  });

  it('lists published ideas without auth when PUBLIC_CATALOG=true', async () => {
    prisma.setCatalog(true);
    prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
      publishedAt: new Date('2026-08-12'),
    });
    prisma.seedIdea({
      slug: 'published-b',
      title: 'Published B',
      status: IdeaStatus.PUBLISHED,
      publishedAt: new Date('2026-08-11'),
    });

    const res = await request(server()).get('/public/ideas').expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].slug).toBe('published-a');
    expect(res.body.items[1].slug).toBe('published-b');
  });

  it('excludes non-published ideas from list', async () => {
    prisma.setCatalog(true);
    prisma.seedIdea({
      slug: 'published',
      title: 'Published',
      status: IdeaStatus.PUBLISHED,
    });
    prisma.seedIdea({
      slug: 'draft',
      title: 'Draft',
      status: IdeaStatus.DRAFT,
    });
    prisma.seedIdea({
      slug: 'archived',
      title: 'Archived',
      status: IdeaStatus.ARCHIVED,
    });

    const res = await request(server()).get('/public/ideas').expect(200);
    expect(res.body.items.map((item: { slug: string }) => item.slug)).toEqual([
      'published',
    ]);
  });

  it('supports pagination', async () => {
    prisma.setCatalog(true);
    for (let i = 1; i <= 3; i += 1) {
      prisma.seedIdea({
        slug: `published-${i}`,
        title: `Published ${i}`,
        status: IdeaStatus.PUBLISHED,
        publishedAt: new Date(`2026-08-${10 + i}`),
      });
    }

    const res = await request(server())
      .get('/public/ideas?page=2&pageSize=1')
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.total).toBe(3);
  });

  it('returns detail for published idea', async () => {
    prisma.setCatalog(true);
    const idea = prisma.seedIdea({
      slug: 'detail-slug',
      title: 'Detail Title',
      status: IdeaStatus.PUBLISHED,
      expertName: 'Пётр Петров',
    });

    const res = await request(server())
      .get(`/public/ideas/${idea.slug}`)
      .expect(200);
    expect(res.body.title).toBe('Detail Title');
    expect(res.body.authorName).toBe('Пётр Петров');
    expect(res.body.voteCount).toBe(0);
  });

  it('returns 404 for draft and archived detail', async () => {
    prisma.setCatalog(true);
    const draft = prisma.seedIdea({
      slug: 'draft-slug',
      title: 'Draft',
      status: IdeaStatus.DRAFT,
    });
    const archived = prisma.seedIdea({
      slug: 'archived-slug',
      title: 'Archived',
      status: IdeaStatus.ARCHIVED,
    });

    await request(server()).get(`/public/ideas/${draft.slug}`).expect(404);
    await request(server()).get(`/public/ideas/${archived.slug}`).expect(404);
  });

  it('returns 404 for unknown slug', async () => {
    prisma.setCatalog(true);
    await request(server()).get('/public/ideas/unknown-slug').expect(404);
  });

  it('does not expose admin fields in public DTO', async () => {
    prisma.setCatalog(true);
    const idea = prisma.seedIdea({
      slug: 'safe-dto',
      title: 'Safe DTO',
      status: IdeaStatus.PUBLISHED,
    });

    const list = await request(server()).get('/public/ideas').expect(200);
    const item = list.body.items[0];
    expect(item).not.toHaveProperty('publicNumber');
    expect(item).not.toHaveProperty('status');
    expect(item).not.toHaveProperty('sourceType');

    const detail = await request(server())
      .get(`/public/ideas/${idea.slug}`)
      .expect(200);
    expect(detail.body).not.toHaveProperty('publicNumber');
    expect(detail.body).not.toHaveProperty('status');
    expect(detail.body).not.toHaveProperty('sourceType');
  });

  it('serves published image and blocks draft image', async () => {
    prisma.setCatalog(true);
    const published = prisma.seedIdea({
      slug: 'with-image',
      title: 'With Image',
      status: IdeaStatus.PUBLISHED,
    });
    prisma.seedImage(published.id);

    const draft = prisma.seedIdea({
      slug: 'draft-image',
      title: 'Draft Image',
      status: IdeaStatus.DRAFT,
    });
    prisma.seedImage(draft.id);

    await request(server())
      .get(`/public/ideas/${published.slug}/image/thumbnail`)
      .expect(200);

    await request(server())
      .get(`/public/ideas/${draft.slug}/image/thumbnail`)
      .expect(404);
  });

  it('map endpoint returns only published ideas with coordinates', async () => {
    prisma.setCatalog(true);
    prisma.seedIdea({
      slug: 'map-a',
      title: 'Map A',
      status: IdeaStatus.PUBLISHED,
    });
    prisma.seedIdea({
      slug: 'map-no-coords',
      title: 'No Coords',
      status: IdeaStatus.PUBLISHED,
      latitude: null,
      longitude: null,
    });
    prisma.seedIdea({
      slug: 'map-draft',
      title: 'Map Draft',
      status: IdeaStatus.DRAFT,
    });

    const res = await request(server()).get('/public/map/ideas').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual({
      slug: 'map-a',
      title: 'Map A',
      authorName: 'Иван Иванов',
      latitude: 56.01,
      longitude: 92.87,
      thumbnailUrl: null,
    });
    expect(res.body.items[0]).not.toHaveProperty('description');
  });

  it('reflects PUBLIC_CATALOG toggle immediately', async () => {
    prisma.seedIdea({
      slug: 'toggle-test',
      title: 'Toggle Test',
      status: IdeaStatus.PUBLISHED,
    });

    await request(server()).get('/public/ideas').expect(404);
    prisma.setCatalog(true);
    await request(server()).get('/public/ideas').expect(200);
  });
});
