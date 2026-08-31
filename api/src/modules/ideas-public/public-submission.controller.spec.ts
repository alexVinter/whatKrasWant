/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import {
  IdeaSourceType,
  IdeaStatus,
  TerritoryType,
  type Idea,
  type IdeaImage,
  type IdeaRevision,
  type IdeaTopic,
  type PublicSession,
  type SystemSetting,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { IdeaImageService } from '../ideas/idea-image.service';
import { IdeasService } from '../ideas/ideas.service';
import { AuditService } from '../audit/audit.service';
import { PublicAuthService } from '../public-auth/public-auth.service';
import { PublicAuthGuard } from '../public-auth/guards/public-auth.guard';
import { VkIdClient } from '../public-auth/vk-id.client';
import { PUBLIC_SESSION_COOKIE } from '../public-auth/public-auth.constants';
import { PublicIdeasController } from './public-ideas.controller';
import { PublicMapController } from './public-map.controller';
import { PublicIdeasService } from './public-ideas.service';
import { PublicSubmissionService } from './public-submission.service';

const RAW_TOKEN = 'public-session-token';
const TOPIC_ID = '550e8400-e29b-41d4-a716-446655440000';
const KRAS_LAT = 56.0153;
const KRAS_LNG = 92.8932;
const OUT_LAT = 55.7558;
const OUT_LNG = 37.6173;
const LONG_DESC =
  'Описание инициативы, достаточно длинное для прохождения валидации минимум пятьдесят символов.';

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
      body: stored.body,
      contentType: stored.contentType,
      contentLength: stored.body.length,
    });
  }

  deleteObjects(): Promise<void> {
    return Promise.resolve();
  }
}

class FakePrisma {
  ideas: Idea[] = [];
  ideaImages: IdeaImage[] = [];
  ideaRevisions: IdeaRevision[] = [];
  ideaTopics: IdeaTopic[] = [];
  users: User[] = [];
  sessions: PublicSession[] = [];
  settings: SystemSetting[] = [
    {
      key: 'PUBLIC_CATALOG',
      value: true,
      updatedBy: null,
      updatedAt: new Date(),
    },
    {
      key: 'PUBLIC_SUBMISSION',
      value: true,
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

  private ideaCounter = 0;
  private imageCounter = 0;
  private revisionCounter = 0;

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

  ideaTopic = {
    findFirst: (args: {
      where: { id: string; isActive?: boolean };
    }): Promise<IdeaTopic | null> => {
      const row = this.ideaTopics.find(
        (topic) =>
          topic.id === args.where.id &&
          (args.where.isActive === undefined || topic.isActive === args.where.isActive),
      );
      return Promise.resolve(row ?? null);
    },
    findUnique: (args: { where: { id: string } }): Promise<IdeaTopic | null> => {
      return Promise.resolve(
        this.ideaTopics.find((topic) => topic.id === args.where.id) ?? null,
      );
    },
  };

  idea = {
    create: (args: { data: any }): Promise<Idea> => {
      this.ideaCounter += 1;
      const now = new Date();
      const idea: Idea = {
        id: `idea-${this.ideaCounter}`,
        publicNumber: this.ideaCounter,
        slug: args.data.slug,
        sourceType: args.data.sourceType,
        expertName: args.data.expertName ?? null,
        expertOrg: args.data.expertOrg ?? null,
        title: args.data.title,
        description: args.data.description,
        territoryType: args.data.territoryType,
        address: args.data.address ?? null,
        latitude: args.data.latitude ?? null,
        longitude: args.data.longitude ?? null,
        status: args.data.status,
        isTop20: false,
        submittedAt: args.data.submittedAt ?? null,
        publishedAt: args.data.publishedAt ?? null,
        createdAt: now,
        updatedAt: now,
        topicId: args.data.topicId ?? null,
        userId: args.data.userId ?? null,
      };
      this.ideas.push(idea);
      return Promise.resolve(idea);
    },
    findUnique: (args: { where: { id?: string; slug?: string }; include?: any }): Promise<any> => {
      const row =
        this.ideas.find(
          (idea) =>
            (args.where.id && idea.id === args.where.id) ||
            (args.where.slug && idea.slug === args.where.slug),
        ) ?? null;
      if (!row) {
        return Promise.resolve(null);
      }
      const image = this.ideaImages.find((item) => item.ideaId === row.id) ?? null;
      return Promise.resolve({ ...row, image, districts: [] });
    },
    findMany: (args: any): Promise<any[]> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where.status);
      }
      if (args.where?.latitude?.not === null) {
        rows = rows.filter((row) => row.latitude !== null && row.longitude !== null);
      }
      return Promise.resolve(rows);
    },
    count: (args: { where?: { status?: IdeaStatus } }): Promise<number> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where!.status);
      }
      return Promise.resolve(rows.length);
    },
    delete: (args: { where: { id: string } }): Promise<Idea> => {
      const index = this.ideas.findIndex((idea) => idea.id === args.where.id);
      const [removed] = this.ideas.splice(index, 1);
      return Promise.resolve(removed);
    },
    update: (args: { where: { id: string }; data: Partial<Idea> }): Promise<Idea> => {
      const row = this.ideas.find((idea) => idea.id === args.where.id)!;
      Object.assign(row, args.data, { updatedAt: new Date() });
      return Promise.resolve(row);
    },
  };

  ideaImage = {
    create: (args: { data: any }): Promise<IdeaImage> => {
      this.imageCounter += 1;
      const image: IdeaImage = {
        id: `image-${this.imageCounter}`,
        ideaId: args.data.ideaId,
        originalKey: args.data.originalKey,
        optimizedKey: args.data.optimizedKey,
        thumbnailKey: args.data.thumbnailKey,
        mimeType: args.data.mimeType,
        size: args.data.size,
        createdAt: new Date(),
      };
      this.ideaImages.push(image);
      return Promise.resolve(image);
    },
    findUnique: (args: { where: { ideaId: string } }): Promise<IdeaImage | null> => {
      return Promise.resolve(
        this.ideaImages.find((image) => image.ideaId === args.where.ideaId) ?? null,
      );
    },
    delete: (args: { where: { ideaId: string } }): Promise<IdeaImage> => {
      const index = this.ideaImages.findIndex(
        (image) => image.ideaId === args.where.ideaId,
      );
      const [removed] = this.ideaImages.splice(index, 1);
      return Promise.resolve(removed);
    },
  };

  ideaRevision = {
    create: (args: { data: any }): Promise<IdeaRevision> => {
      this.revisionCounter += 1;
      const revision: IdeaRevision = {
        id: `revision-${this.revisionCounter}`,
        ideaId: args.data.ideaId,
        actorAdminId: args.data.actorAdminId ?? null,
        snapshotJson: args.data.snapshotJson,
        reason: args.data.reason ?? null,
        createdAt: new Date(),
      };
      this.ideaRevisions.push(revision);
      return Promise.resolve(revision);
    },
  };

  publicSession = {
    findUnique: (args: {
      where: { tokenHash: string };
      include?: { user?: boolean };
    }): Promise<(PublicSession & { user: User }) | null> => {
      const session =
        this.sessions.find((item) => item.tokenHash === args.where.tokenHash) ?? null;
      if (!session) {
        return Promise.resolve(null);
      }
      const user = this.users.find((item) => item.id === session.userId)!;
      return Promise.resolve({ ...session, user });
    },
  };

  seedTopic(): IdeaTopic {
    const now = new Date();
    const topic: IdeaTopic = {
      id: TOPIC_ID,
      name: 'Благоустройство',
      slug: 'blagoustroistvo',
      sortOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.ideaTopics.push(topic);
    return topic;
  }

  seedUser(overrides: Partial<User> = {}): User {
    const now = new Date();
    const user: User = {
      id: 'user-1',
      vkId: '123456789',
      firstName: 'Иван',
      lastName: 'Иванов',
      avatarUrl: null,
      isBlocked: false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
    this.users.push(user);
    return user;
  }

  seedSession(user: User): PublicSession {
    const session: PublicSession = {
      id: 'public-session-1',
      userId: user.id,
      tokenHash: createHash('sha256').update(RAW_TOKEN).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    };
    this.sessions.push(session);
    return session;
  }

  setSubmission(enabled: boolean): void {
    const row = this.settings.find((item) => item.key === 'PUBLIC_SUBMISSION');
    if (row) {
      row.value = enabled;
    }
  }
}

describe('Public submission (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let validJpeg: Buffer;

  beforeAll(async () => {
    validJpeg = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100, g: 110, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.seedTopic();
    const user = prisma.seedUser();
    prisma.seedSession(user);

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [PublicIdeasController, PublicMapController],
      providers: [
        PublicIdeasService,
        PublicSubmissionService,
        PublicAuthService,
        PublicAuthGuard,
        SettingsService,
        IdeasService,
        IdeaImageService,
        AuditService,
        VkIdClient,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: new FakeStorage() },
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

  const authCookie = `${PUBLIC_SESSION_COOKIE}=${RAW_TOKEN}`;

  const submitBody = (overrides: Record<string, string | number> = {}) => ({
    topicId: TOPIC_ID,
    title: 'Инициатива по благоустройству набережной',
    description: LONG_DESC,
    address: 'Набережная Енисея',
    latitude: KRAS_LAT,
    longitude: KRAS_LNG,
    ...overrides,
  });

  it('returns 401 without public session', async () => {
    await request(server())
      .post('/public/ideas')
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(401);
  });

  it('returns 403 for blocked user', async () => {
    prisma.users[0].isBlocked = true;
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(403);
  });

  it('returns 404 when PUBLIC_SUBMISSION=false', async () => {
    prisma.setSubmission(false);
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(404);
  });

  it('creates MODERATION RESIDENT idea for authenticated user', async () => {
    const res = await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная Енисея')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(201);

    expect(res.body.status).toBe(IdeaStatus.MODERATION);
    expect(prisma.ideas[0].sourceType).toBe(IdeaSourceType.RESIDENT);
    expect(prisma.ideas[0].userId).toBe('user-1');
    expect(prisma.ideas[0].status).toBe(IdeaStatus.MODERATION);
    expect(prisma.ideas[0].expertName).toBe('Иван Иванов');
    expect(prisma.ideas[0].submittedAt).not.toBeNull();
  });

  it('ignores forged server-owned fields', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .field('status', IdeaStatus.PUBLISHED)
      .field('sourceType', IdeaSourceType.EXPERT)
      .field('userId', 'fake-user')
      .expect(400);
  });

  it('rejects invalid topic', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', '22222222-2222-2222-2222-222222222222')
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(400);
  });

  it('rejects missing geo', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .expect(400);
  });

  it('rejects point outside Krasnoyarsk', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Москва')
      .field('latitude', String(OUT_LAT))
      .field('longitude', String(OUT_LNG))
      .expect(400);
  });

  it('accepts valid geo point', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .expect(201);
  });

  it('uploads one valid image', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .attach('image', validJpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(prisma.ideaImages).toHaveLength(1);
  });

  it('rejects invalid image', async () => {
    await request(server())
      .post('/public/ideas')
      .set('Cookie', authCookie)
      .field('topicId', TOPIC_ID)
      .field('title', submitBody().title)
      .field('description', LONG_DESC)
      .field('address', 'Набережная')
      .field('latitude', String(KRAS_LAT))
      .field('longitude', String(KRAS_LNG))
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'bad.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    expect(prisma.ideas).toHaveLength(0);
  });

  it('does not expose MODERATION idea in public list', async () => {
    const now = new Date();
    prisma.ideas.push({
      id: 'idea-mod',
      publicNumber: 1,
      slug: 'moderation-slug',
      sourceType: IdeaSourceType.RESIDENT,
      expertName: 'Иван Иванов',
      expertOrg: null,
      title: 'Moderation idea',
      description: LONG_DESC,
      territoryType: TerritoryType.CITYWIDE,
      address: 'Addr',
      latitude: KRAS_LAT,
      longitude: KRAS_LNG,
      status: IdeaStatus.MODERATION,
      isTop20: false,
      submittedAt: now,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      topicId: TOPIC_ID,
      userId: 'user-1',
    });

    const list = await request(server()).get('/public/ideas').expect(200);
    expect(list.body.items).toHaveLength(0);

    await request(server()).get('/public/ideas/moderation-slug').expect(404);
  });

  it('returns published resident idea in public list with author name', async () => {
    const now = new Date();
    prisma.ideas.push({
      id: 'idea-pub',
      publicNumber: 2,
      slug: 'published-slug',
      sourceType: IdeaSourceType.RESIDENT,
      expertName: 'Иван Иванов',
      expertOrg: null,
      title: 'Published idea',
      description: LONG_DESC,
      territoryType: TerritoryType.CITYWIDE,
      address: 'Addr',
      latitude: KRAS_LAT,
      longitude: KRAS_LNG,
      status: IdeaStatus.PUBLISHED,
      isTop20: false,
      submittedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      topicId: TOPIC_ID,
      userId: 'user-1',
    });

    const list = await request(server()).get('/public/ideas').expect(200);
    expect(list.body.items[0].authorName).toBe('Иван Иванов');
    expect(list.body.items[0]).not.toHaveProperty('userId');
    expect(list.body.items[0]).not.toHaveProperty('vkId');
  });
});
