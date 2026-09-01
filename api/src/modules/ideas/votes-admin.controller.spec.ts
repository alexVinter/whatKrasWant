/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createHash } from 'node:crypto';
import {
  AdminStatus,
  IdeaStatus,
  type AdminSession,
  type AdminUser,
  type Idea,
  type Vote,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuthService } from '../admin-auth/admin-auth.service';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.constants';
import { VotesAdminController } from './votes-admin.controller';
import { VotesAdminService } from './votes-admin.service';

jest.mock('@node-rs/argon2', () => ({
  hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  verify: jest.fn(() => Promise.resolve(true)),
}));

const RAW_TOKEN = 'valid-session-token';
const AUTH_COOKIE = `wkw_admin_session=${RAW_TOKEN}`;

class FakePrisma {
  admins: AdminUser[] = [];
  sessions: AdminSession[] = [];
  ideas: Idea[] = [];
  votes: Vote[] = [];
  auditLogs: any[] = [];

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
      if (!session) {
        return Promise.resolve(null);
      }
      const adminUser = this.admins.find((a) => a.id === session.adminUserId)!;
      return Promise.resolve({ ...session, adminUser });
    },
  };

  idea = {
    findUnique: (args: { where: { id: string } }): Promise<Idea | null> =>
      Promise.resolve(this.ideas.find((idea) => idea.id === args.where.id) ?? null),
  };

  vote = {
    findUnique: (args: { where: { id: string } }): Promise<Vote | null> =>
      Promise.resolve(this.votes.find((vote) => vote.id === args.where.id) ?? null),
    findMany: (args: {
      where: { ideaId: string };
      select?: Record<string, boolean>;
      orderBy?: { createdAt: 'asc' | 'desc' };
    }): Promise<Vote[]> => {
      let rows = this.votes.filter((vote) => vote.ideaId === args.where.ideaId);
      if (args.orderBy?.createdAt === 'asc') {
        rows = [...rows].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
      }
      return Promise.resolve(rows);
    },
    update: (args: {
      where: { id: string };
      data: Partial<Vote>;
    }): Promise<Vote> => {
      const vote = this.votes.find((item) => item.id === args.where.id)!;
      Object.assign(vote, args.data);
      return Promise.resolve(vote);
    },
  };

  adminAuditLog = {
    create: (args: { data: any }): Promise<any> => {
      this.auditLogs.push(args.data);
      return Promise.resolve(args.data);
    },
  };

  seedAdmin(): AdminUser {
    const admin: AdminUser = {
      id: 'admin-1',
      login: 'admin',
      email: null,
      passwordHash: 'hash',
      status: AdminStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.admins.push(admin);
    this.sessions.push({
      id: 'admin-session-1',
      adminUserId: admin.id,
      tokenHash: createHash('sha256').update(RAW_TOKEN).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      revokedAt: null,
    });
    return admin;
  }

  seedIdea(): Idea {
    const idea: Idea = {
      id: 'idea-1',
      publicNumber: 1,
      slug: 'idea-slug',
      sourceType: 'EXPERT',
      expertName: 'Author',
      expertOrg: null,
      title: 'Title',
      description: 'Description long enough for tests and validation rules.',
      topicId: null,
      userId: null,
      territoryType: 'CITYWIDE',
      address: null,
      latitude: null,
      longitude: null,
      status: IdeaStatus.PUBLISHED,
      isTop20: false,
      submittedAt: null,
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ideas.push(idea);
    return idea;
  }

  seedVotes(ideaId: string): void {
    for (let i = 1; i <= 4; i += 1) {
      this.votes.push({
        id: `vote-${i}`,
        ideaId,
        userId: `user-${i}`,
        ipHash: i <= 3 ? 'same-ip-hash-value-abcdef0123456789' : 'other-ip-hash',
        userAgentHash: `ua-${i}`,
        isExcluded: false,
        excludedAt: null,
        exclusionReason: null,
        createdAt: new Date(Date.now() + i * 1000),
      });
    }
  }
}

describe('VotesAdminController (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let auditWrite: jest.Mock;

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.seedAdmin();
    auditWrite = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [VotesAdminController],
      providers: [
        VotesAdminService,
        AdminAuthService,
        AdminAuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { write: auditWrite } },
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

  it('returns vote summary with suspicious ip groups', async () => {
    const idea = prisma.seedIdea();
    prisma.seedVotes(idea.id);

    const res = await request(server())
      .get(`/admin/ideas/${idea.id}/votes/summary`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(res.body.totalVotes).toBe(4);
    expect(res.body.countedVotes).toBe(4);
    expect(res.body.excludedVotes).toBe(0);
    expect(res.body.suspiciousIpGroups).toHaveLength(1);
    expect(res.body.suspiciousIpGroups[0].userCount).toBe(3);
    expect(res.body.suspiciousIpGroups[0].ipHashPrefix).toMatch(/^same-ip-hash…$/);
    expect(res.body.suspiciousIpGroups[0].ipHashPrefix).not.toContain('203.0.113');
  });

  it('excludes vote and writes audit log without deleting row', async () => {
    const idea = prisma.seedIdea();
    prisma.seedVotes(idea.id);
    const voteId = prisma.votes[0].id;

    await request(server())
      .post(`/admin/votes/${voteId}/exclude`)
      .set('Cookie', AUTH_COOKIE)
      .send({ reason: 'suspicious cluster' })
      .expect(200);

    expect(prisma.votes).toHaveLength(4);
    expect(prisma.votes[0].isExcluded).toBe(true);
    expect(prisma.votes[0].exclusionReason).toBe('suspicious cluster');
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.VOTE_EXCLUDED,
        entityType: AUDIT_ENTITIES.VOTE,
        entityId: voteId,
      }),
      expect.anything(),
    );
  });

  it('restores excluded vote and writes audit log', async () => {
    const idea = prisma.seedIdea();
    prisma.seedVotes(idea.id);
    const vote = prisma.votes[0];
    vote.isExcluded = true;
    vote.excludedAt = new Date();
    vote.exclusionReason = 'test';

    await request(server())
      .post(`/admin/votes/${vote.id}/restore`)
      .set('Cookie', AUTH_COOKIE)
      .expect(200);

    expect(prisma.votes[0].isExcluded).toBe(false);
    expect(prisma.votes[0].excludedAt).toBeNull();
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.VOTE_RESTORED,
        entityType: AUDIT_ENTITIES.VOTE,
        entityId: vote.id,
      }),
      expect.anything(),
    );
  });
});
