/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  IdeaSourceType,
  IdeaStatus,
  TerritoryType,
  type Idea,
  type PublicSession,
  type SystemSetting,
  type User,
  type Vote,
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
import { PublicVoteService } from './public-vote.service';
import { hashVoteFingerprint } from '../../common/vote-fraud/vote-fraud-hash.util';

const RAW_TOKEN = 'public-session-token';
const VOTE_SECRET = 'test-vote-fraud-secret';
const authCookie = `${PUBLIC_SESSION_COOKIE}=${RAW_TOKEN}`;

class FakeStorage {
  putObject(): Promise<void> {
    return Promise.resolve();
  }
  getObject() {
    return Promise.reject(new Error('not used'));
  }
  deleteObjects(): Promise<void> {
    return Promise.resolve();
  }
}

class FakePrisma {
  ideas: Idea[] = [];
  users: User[] = [];
  sessions: PublicSession[] = [];
  votes: Vote[] = [];
  settings: SystemSetting[] = [
    {
      key: 'PUBLIC_CATALOG',
      value: true,
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
      value: true,
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
  private voteCounter = 0;

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
      return Promise.resolve(
        rows.map((row) => {
          if (args.select) {
            return this.selectIdea(row, args.select);
          }
          return { ...row, districts: [], image: null };
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
      if (args.select) {
        return Promise.resolve(this.selectIdea(row, args.select));
      }
      return Promise.resolve({ ...row, districts: [], image: null });
    },
    count: (args: any): Promise<number> => {
      let rows = [...this.ideas];
      if (args.where?.status) {
        rows = rows.filter((row) => row.status === args.where.status);
      }
      return Promise.resolve(rows.length);
    },
  };

  vote = {
    findUnique: (args: {
      where: { ideaId_userId?: { ideaId: string; userId: string }; id?: string };
    }): Promise<Vote | null> => {
      if (args.where.ideaId_userId) {
        const { ideaId, userId } = args.where.ideaId_userId;
        return Promise.resolve(
          this.votes.find((vote) => vote.ideaId === ideaId && vote.userId === userId) ??
            null,
        );
      }
      if (args.where.id) {
        return Promise.resolve(
          this.votes.find((vote) => vote.id === args.where.id) ?? null,
        );
      }
      return Promise.resolve(null);
    },
    create: (args: { data: any }): Promise<Vote> => {
      const duplicate = this.votes.find(
        (vote) =>
          vote.ideaId === args.data.ideaId && vote.userId === args.data.userId,
      );
      if (duplicate) {
        const error = new Error('Unique constraint failed');
        (error as any).code = 'P2002';
        return Promise.reject(error);
      }
      this.voteCounter += 1;
      const vote: Vote = {
        id: `vote-${this.voteCounter}`,
        ideaId: args.data.ideaId,
        userId: args.data.userId,
        ipHash: args.data.ipHash ?? null,
        userAgentHash: args.data.userAgentHash ?? null,
        isExcluded: false,
        excludedAt: null,
        exclusionReason: null,
        createdAt: new Date(),
      };
      this.votes.push(vote);
      return Promise.resolve(vote);
    },
    count: (args: {
      where: {
        ideaId?: string | { in?: string[] };
        isExcluded?: boolean;
      };
    }): Promise<number> => {
      let rows = [...this.votes];
      if (args.where.ideaId && typeof args.where.ideaId === 'string') {
        rows = rows.filter((vote) => vote.ideaId === args.where.ideaId);
      }
      if (args.where.isExcluded === false) {
        rows = rows.filter((vote) => !vote.isExcluded);
      }
      return Promise.resolve(rows.length);
    },
    groupBy: (args: {
      by: string[];
      where?: { ideaId?: { in?: string[] }; isExcluded?: boolean };
      _count?: { _all: true };
    }): Promise<any[]> => {
      let rows = [...this.votes];
      if (args.where?.ideaId?.in) {
        rows = rows.filter((vote) => args.where!.ideaId!.in!.includes(vote.ideaId));
      }
      if (args.where?.isExcluded === false) {
        rows = rows.filter((vote) => !vote.isExcluded);
      }
      const grouped = new Map<string, number>();
      for (const vote of rows) {
        grouped.set(vote.ideaId, (grouped.get(vote.ideaId) ?? 0) + 1);
      }
      return Promise.resolve(
        [...grouped.entries()].map(([ideaId, count]) => ({
          ideaId,
          _count: { _all: count },
        })),
      );
    },
    update: (args: {
      where: { id: string };
      data: Partial<Vote>;
    }): Promise<Vote> => {
      const vote = this.votes.find((item) => item.id === args.where.id);
      if (!vote) {
        throw new Error('Vote not found');
      }
      Object.assign(vote, args.data);
      return Promise.resolve(vote);
    },
    findMany: (args: any): Promise<Vote[]> => {
      let rows = [...this.votes];
      if (args.where?.ideaId) {
        rows = rows.filter((vote) => vote.ideaId === args.where.ideaId);
      }
      return Promise.resolve(rows);
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

  private selectIdea(row: Idea, select: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
      if (key === 'image') {
        result.image = null;
      } else if (key === 'districts') {
        result.districts = [];
      } else {
        result[key] = row[key as keyof Idea];
      }
    }
    return result;
  }

  seedIdea(overrides: Partial<Idea> & Pick<Idea, 'slug' | 'title' | 'status'>): Idea {
    this.ideaCounter += 1;
    const idea: Idea = {
      id: `idea-${this.ideaCounter}`,
      publicNumber: this.ideaCounter,
      slug: overrides.slug,
      sourceType: overrides.sourceType ?? IdeaSourceType.EXPERT,
      expertName: overrides.expertName ?? 'Иван Иванов',
      expertOrg: overrides.expertOrg ?? null,
      title: overrides.title,
      description:
        overrides.description ??
        'Описание тестовой инициативы достаточно длинное для публикации и проверки публичного API.',
      topicId: overrides.topicId ?? null,
      userId: overrides.userId ?? null,
      territoryType: overrides.territoryType ?? TerritoryType.DISTRICTS,
      address: overrides.address ?? 'пр. Мира',
      latitude: overrides.latitude ?? 56.01,
      longitude: overrides.longitude ?? 92.87,
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

  seedUser(overrides: Partial<User> = {}): User {
    const now = new Date();
    const user: User = {
      id: overrides.id ?? 'user-1',
      vkId: overrides.vkId ?? '123456789',
      firstName: overrides.firstName ?? 'Иван',
      lastName: overrides.lastName ?? 'Иванов',
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
      id: `session-${user.id}`,
      userId: user.id,
      tokenHash: createHash('sha256').update(RAW_TOKEN).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    };
    this.sessions.push(session);
    return session;
  }

  setVoting(enabled: boolean): void {
    const row = this.settings.find((item) => item.key === 'VOTING');
    if (row) {
      row.value = enabled;
    }
  }
}

describe('Public voting (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const user = prisma.seedUser();
    prisma.seedSession(user);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ VOTE_FRAUD_HASH_SECRET: VOTE_SECRET })],
        }),
      ],
      controllers: [PublicIdeasController, PublicMapController],
      providers: [
        PublicIdeasService,
        PublicSubmissionService,
        PublicVoteService,
        PublicAuthService,
        PublicAuthGuard,
        SettingsService,
        IdeasService,
        IdeaImageService,
        VkIdClient,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: new FakeStorage() },
        {
          provide: AuditService,
          useValue: { write: jest.fn().mockResolvedValue(undefined) },
        },
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

  it('returns 401 without PublicSession', async () => {
    prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server())
      .post('/public/ideas/published-a/vote')
      .expect(401);
  });

  it('returns 403 for blocked user', async () => {
    prisma.users[0].isBlocked = true;
    prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server())
      .post('/public/ideas/published-a/vote')
      .set('Cookie', authCookie)
      .expect(403);
  });

  it('returns 404 when VOTING=false', async () => {
    prisma.setVoting(false);
    prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server())
      .post('/public/ideas/published-a/vote')
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('returns 404 for unknown idea', async () => {
    await request(server())
      .post('/public/ideas/unknown-slug/vote')
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('returns 404 for MODERATION idea', async () => {
    const idea = prisma.seedIdea({
      slug: 'moderation-a',
      title: 'Moderation A',
      status: IdeaStatus.MODERATION,
    });
    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('returns 404 for ARCHIVED idea', async () => {
    const idea = prisma.seedIdea({
      slug: 'archived-a',
      title: 'Archived A',
      status: IdeaStatus.ARCHIVED,
    });
    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(404);
  });

  it('creates vote for PUBLISHED idea and uses session userId', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });

    const res = await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .set('X-Forwarded-For', '203.0.113.10')
      .set('User-Agent', 'TestAgent/1.0')
      .expect(201);

    expect(res.body.hasVoted).toBe(true);
    expect(res.body.voteCount).toBe(1);
    expect(prisma.votes).toHaveLength(1);
    expect(prisma.votes[0].userId).toBe('user-1');
    expect(prisma.votes[0].ideaId).toBe(idea.id);
  });

  it('returns 409 on duplicate vote', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });

    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(201);

    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(409);

    expect(prisma.votes).toHaveLength(1);
  });

  it('allows different users to vote for the same idea', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });

    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(201);

    const user2 = prisma.seedUser({
      id: 'user-2',
      vkId: '987654321',
      firstName: 'Пётр',
      lastName: 'Петров',
    });
    prisma.sessions.push({
      id: 'session-user-2',
      userId: user2.id,
      tokenHash: createHash('sha256').update('token-user-2').digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    });

    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', `${PUBLIC_SESSION_COOKIE}=token-user-2`)
      .expect(201);

    expect(prisma.votes).toHaveLength(2);
  });

  it('counts only non-excluded votes in voteCount', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    prisma.votes.push({
      id: 'vote-1',
      ideaId: idea.id,
      userId: 'user-1',
      ipHash: 'hash-a',
      userAgentHash: 'hash-b',
      isExcluded: true,
      excludedAt: new Date(),
      exclusionReason: 'suspicious',
      createdAt: new Date(),
    });
    const user2 = prisma.seedUser({
      id: 'user-2',
      vkId: '987654321',
    });
    prisma.sessions.push({
      id: 'session-user-2',
      userId: user2.id,
      tokenHash: createHash('sha256').update('token-user-2').digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    });

    const res = await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', `${PUBLIC_SESSION_COOKIE}=token-user-2`)
      .expect(201);

    expect(res.body.voteCount).toBe(1);
    expect(prisma.votes).toHaveLength(2);
  });

  it('stores HMAC hashes instead of raw IP and user-agent', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    const rawIp = '203.0.113.10';
    const rawUa = 'TestAgent/1.0';

    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .set('X-Forwarded-For', rawIp)
      .set('User-Agent', rawUa)
      .expect(201);

    const vote = prisma.votes[0];
    expect(vote.ipHash).toBe(hashVoteFingerprint(VOTE_SECRET, rawIp));
    expect(vote.userAgentHash).toBe(hashVoteFingerprint(VOTE_SECRET, rawUa));
    expect(vote.ipHash).not.toBe(rawIp);
    expect(JSON.stringify(vote)).not.toContain(rawIp);
  });

  it('does not expose vote metadata in public detail DTO', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });
    await request(server())
      .post(`/public/ideas/${idea.slug}/vote`)
      .set('Cookie', authCookie)
      .expect(201);

    const detail = await request(server())
      .get(`/public/ideas/${idea.slug}`)
      .set('Cookie', authCookie)
      .expect(200);

    expect(detail.body.voteCount).toBe(1);
    expect(detail.body.hasVoted).toBe(true);
    expect(detail.body).not.toHaveProperty('ipHash');
    expect(detail.body).not.toHaveProperty('userId');
    expect(detail.body).not.toHaveProperty('vkId');
  });

  it('sorts public list by voteCount desc', async () => {
    const low = prisma.seedIdea({
      slug: 'low-votes',
      title: 'Low',
      status: IdeaStatus.PUBLISHED,
      publishedAt: new Date('2026-08-12'),
    });
    const high = prisma.seedIdea({
      slug: 'high-votes',
      title: 'High',
      status: IdeaStatus.PUBLISHED,
      publishedAt: new Date('2026-08-11'),
    });
    prisma.votes.push(
      {
        id: 'vote-1',
        ideaId: high.id,
        userId: 'user-1',
        ipHash: null,
        userAgentHash: null,
        isExcluded: false,
        excludedAt: null,
        exclusionReason: null,
        createdAt: new Date(),
      },
      {
        id: 'vote-2',
        ideaId: high.id,
        userId: 'user-2',
        ipHash: null,
        userAgentHash: null,
        isExcluded: false,
        excludedAt: null,
        exclusionReason: null,
        createdAt: new Date(),
      },
    );
    prisma.seedUser({ id: 'user-2', vkId: '222' });

    const res = await request(server()).get('/public/ideas').expect(200);
    expect(res.body.items[0].slug).toBe('high-votes');
    expect(res.body.items[0].voteCount).toBe(2);
    expect(res.body.items[1].slug).toBe('low-votes');
    expect(res.body.items[1].voteCount).toBe(0);
    expect(low.id).toBeDefined();
  });

  it('handles parallel duplicate requests with at most one vote', async () => {
    const idea = prisma.seedIdea({
      slug: 'published-a',
      title: 'Published A',
      status: IdeaStatus.PUBLISHED,
    });

    const results = await Promise.allSettled([
      request(server())
        .post(`/public/ideas/${idea.slug}/vote`)
        .set('Cookie', authCookie),
      request(server())
        .post(`/public/ideas/${idea.slug}/vote`)
        .set('Cookie', authCookie),
    ]);

    const statuses = results.map((result) =>
      result.status === 'fulfilled' ? result.value.status : 500,
    );
    expect(statuses.sort()).toEqual([201, 409]);
    expect(prisma.votes).toHaveLength(1);
  });
});
